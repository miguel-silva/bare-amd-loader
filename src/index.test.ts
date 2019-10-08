import { load } from "./index";
import { loadScript } from "./scriptUtils";

const nanoid = require("nanoid");

jest.mock("./scriptUtils");

const mockedLoadScript = loadScript as jest.Mock<
  void,
  Parameters<typeof loadScript>
>;

describe("load()", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("successfully loads a single module", async () => {
    const paths = createUniquePaths([
      "dummy",
      "remoteDep1",
      "remoteDep2",
      "remoteDep3",
    ]);

    mockScriptLoading(paths, [
      { id: "dummy", dependencies: ["remoteDep1", "remoteDep2"] },
      { id: "remoteDep1", dependencies: ["remoteDep2", "localDep1"] },
      { id: "remoteDep2", dependencies: ["remoteDep3"] },
      { id: "remoteDep3" },
    ]);

    //#region expected dummy and related dependencies
    const localDep1 = {
      id: "localDep1",
    };

    const remoteDep2 = {
      id: "remoteDep2",
      args: [
        {
          id: "remoteDep3",
        },
      ],
    };

    const dummy = {
      id: "dummy",
      args: [
        {
          id: "remoteDep1",
          args: [remoteDep2, localDep1],
        },
        remoteDep2,
      ],
    };
    //#endregion expected dummy and related dependencies

    const result = await load("dummy", {
      paths,
      modules: { localDep1 },
    });

    // one for each path
    expect(mockedLoadScript).toHaveBeenCalledTimes(4);

    expect(result).toEqual(dummy);
  });

  test("successfully loads the same module in consecutive calls", async () => {
    const paths = createUniquePaths(["dummy"]);

    mockScriptLoading(paths, [{ id: "dummy" }]);

    const dummy = {
      id: "dummy",
    };

    const result1 = await load("dummy", {
      paths,
    });

    const result2 = await load("dummy", {
      paths,
    });

    // only inject a script once
    expect(mockedLoadScript).toHaveBeenCalledTimes(1);

    expect(result1).toEqual(dummy);
    expect(result1).toEqual(result2);
  });

  test("successfully loads multiple modules in the same call", async () => {
    const paths = createUniquePaths([
      "dummy1",
      "dummy2",
      "remoteDep1",
      "remoteDep2",
    ]);

    mockScriptLoading(paths, [
      { id: "dummy1", dependencies: ["remoteDep1"] },
      { id: "dummy2", dependencies: ["remoteDep1", "remoteDep2"] },
      { id: "remoteDep1" },
      { id: "remoteDep2" },
    ]);

    //#region expected dummy modules and related dependencies
    const remoteDep1 = {
      id: "remoteDep1",
    };

    const dummy1 = {
      id: "dummy1",
      args: [remoteDep1],
    };

    const dummy2 = {
      id: "dummy2",
      args: [remoteDep1, { id: "remoteDep2" }],
    };
    //#endregion expected dummy modules and related dependencies

    const result = await load(["dummy1", "dummy2"], {
      paths,
    });

    // one for each path
    expect(mockedLoadScript).toHaveBeenCalledTimes(4);

    expect(result).toEqual([dummy1, dummy2]);
  });

  test("successfully loads multiple modules in parallel calls", async () => {
    const paths = createUniquePaths([
      "dummy1",
      "dummy2",
      "remoteDep1",
      "remoteDep2",
    ]);

    mockScriptLoading(paths, [
      { id: "dummy1", dependencies: ["remoteDep1"] },
      { id: "dummy2", dependencies: ["remoteDep1", "remoteDep2"] },
      { id: "remoteDep1" },
      { id: "remoteDep2" },
    ]);

    //#region expected dummy modules and related dependencies
    const remoteDep1 = {
      id: "remoteDep1",
    };

    const dummy1 = {
      id: "dummy1",
      args: [remoteDep1],
    };

    const dummy2 = {
      id: "dummy2",
      args: [remoteDep1, { id: "remoteDep2" }],
    };
    //#endregion expected dummy modules and related dependencies

    const result = await Promise.all([
      load("dummy1", {
        paths,
      }),
      load("dummy2", {
        paths,
      }),
    ]);

    // one for each path
    expect(mockedLoadScript).toHaveBeenCalledTimes(4);

    expect(result).toEqual([dummy1, dummy2]);
  });

  test("throws an error when trying to load a module not specified the config", async () => {
    const paths = createUniquePaths(["dummy", "remoteDep1"]);

    mockScriptLoading(paths, [
      { id: "dummy", dependencies: ["remoteDep1"] },
      { id: "remoteDep1", dependencies: ["missingDep"] },
    ]);

    await expect(load("dummy", { paths })).rejects.toMatchInlineSnapshot(
      `[Error: missingDep is missing from config]`
    );
  });

  test("throws an error when failing to load a module", async () => {
    const paths = createUniquePaths(["dummy"]);

    paths.failedDep = "failedDep.js";

    mockScriptLoading(paths, [{ id: "dummy", dependencies: ["failedDep"] }]);

    await expect(load("dummy", { paths })).rejects.toMatchInlineSnapshot(
      `[Error: failedDep.js loading failed]`
    );
  });

  test("throws an error when trying to load a module that is not an AMD module", async () => {
    const paths = createUniquePaths(["dummy"]);

    paths.notAMDDep = "notAMDDep.js";

    mockedLoadScript.mockImplementation(
      (src: string, onLoad: () => void, _onError: () => void) => {
        if (src === paths.dummy) {
          globalDefine(["notAMDDep"], () => {
            return 42;
          });
        }
        onLoad();
      }
    );

    await expect(load("dummy", { paths })).rejects.toMatchInlineSnapshot(
      `[Error: notAMDDep.js is not an AMD module]`
    );
  });

  test("throws an error when the loaded module factory has an exception", async () => {
    const paths = createUniquePaths(["dummy"]);

    paths.exceptionDep = "exceptionDep.js";

    mockedLoadScript.mockImplementation(
      (src: string, onLoad: () => void, _onError: () => void) => {
        if (src === paths.dummy) {
          globalDefine(["exceptionDep"], () => {
            return 42;
          });
        } else {
          globalDefine(() => {
            throw new Error("Ups!");
          });
        }
        onLoad();
      }
    );

    await expect(load("dummy", { paths })).rejects.toMatchInlineSnapshot(
      `[Error: Ups!]`
    );
  });
});

type Paths = { [moduleId: string]: string };

/**
 * given a list of module ids, create a list of unique Paths
 *
 * they need to be unique so that tests are independent from each other, due to the shared cache
 *
 * @param modules
 */
function createUniquePaths(modules: string[]): Paths {
  return modules.reduce((paths: Paths, moduleName: string) => {
    paths[moduleName] = `${moduleName}-${nanoid()}.js`;
    return paths;
  }, {});
}

// @ts-ignore
const globalDefine = window.define;

type ModuleDefinitionArgs = [string[], (...args: any[]) => any] | [() => any];

/**
 * mock loadScript implementation,
 * mapping each partialModuleDefinition into simple factories
 * that generate an object with:
 * - id: string - the module id
 * - args?: any[] - the factory's arguments
 *
 * @param paths
 * @param partialModuleDefinitions
 */
function mockScriptLoading(
  paths: Paths,
  partialModuleDefinitions: { id: string; dependencies?: string[] }[]
) {
  const moduleDefinitionArgsBySrc: {
    [src: string]: ModuleDefinitionArgs;
  } = {};

  // create moduleDefinitionArgsBySrc from paths and partialModuleDefinitions
  partialModuleDefinitions.forEach(({ id, dependencies }) => {
    const src = paths[id];

    let moduleDefinitionArgs: ModuleDefinitionArgs;

    if (dependencies) {
      moduleDefinitionArgs = [
        dependencies,
        (...args: any[]) => ({
          id,
          args,
        }),
      ];
    } else {
      moduleDefinitionArgs = [() => ({ id })];
    }

    moduleDefinitionArgsBySrc[src] = moduleDefinitionArgs;
  });

  mockedLoadScript.mockImplementation(
    (src: string, onLoad: () => void, onError: () => void) => {
      const moduleDefinitionArgs = moduleDefinitionArgsBySrc[src];

      if (!moduleDefinitionArgs) {
        onError();
        return;
      }

      globalDefine(...moduleDefinitionArgs);
      onLoad();
    }
  );
}
