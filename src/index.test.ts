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

  test(`successfully loads a single module named "dummy"`, async () => {
    const paths = createUniquePaths([
      "dummy",
      "remoteDep1",
      "remoteDep2",
      "remoteDep3",
    ]);

    mockScriptLoading(paths, [
      { name: "dummy", dependencies: ["remoteDep1", "remoteDep2"] },
      { name: "remoteDep1", dependencies: ["remoteDep2", "localDep1"] },
      { name: "remoteDep2", dependencies: ["remoteDep3"] },
      { name: "remoteDep3" },
    ]);

    const localDep1 = {
      name: "localDep1",
    };

    const result = await load("dummy", {
      paths,
      modules: { localDep1 },
    });

    expect(mockedLoadScript).toHaveBeenCalledTimes(4);

    expect(result).toMatchInlineSnapshot(`
      Object {
        "deps": Array [
          Object {
            "deps": Array [
              Object {
                "deps": Array [
                  Object {
                    "name": "remoteDep3",
                  },
                ],
                "name": "remoteDep2",
              },
              Object {
                "name": "localDep1",
              },
            ],
            "name": "remoteDep1",
          },
          Object {
            "deps": Array [
              Object {
                "name": "remoteDep3",
              },
            ],
            "name": "remoteDep2",
          },
        ],
        "name": "dummy",
      }
    `);
  });
});

type Paths = { [moduleId: string]: string };

function createUniquePaths(modules: string[]): Paths {
  return modules.reduce((paths: Paths, moduleName: string) => {
    paths[moduleName] = `${moduleName}-${nanoid()}.js`;
    return paths;
  }, {});
}

// @ts-ignore
const globalDefine = window.define;

type ModuleDefinitionArgs = [string[], (...args: any[]) => any] | [() => any];

function mockScriptLoading(
  paths: Paths,
  partialModuleDefinitions: { name: string; dependencies?: string[] }[]
) {
  const moduleDefinitionArgsBySrc: {
    [src: string]: ModuleDefinitionArgs;
  } = {};

  partialModuleDefinitions.forEach(({ name, dependencies }) => {
    const src = paths[name];

    let moduleDefinitionArgs: ModuleDefinitionArgs;

    if (dependencies) {
      moduleDefinitionArgs = [
        dependencies,
        (...deps: any[]) => ({
          name,
          deps,
        }),
      ];
    } else {
      moduleDefinitionArgs = [() => ({ name })];
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
