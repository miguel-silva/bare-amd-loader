import { loadScript } from "./scriptUtils";

export type Config = {
  paths: { [moduleId: string]: string };
  modules?: { [moduleId: string]: any };
};

type Context = {
  modulePromiseById: {
    [moduleId: string]: Promise<any>;
  };
} & Omit<Config, "modules">;

type Factory = (...args: any[]) => any;

type Definition = {
  dependencies?: string[];
  factory: Factory;
};

let pendingDefinition: Definition | undefined;

const definitionPromiseByPath = new Map<string, Promise<Definition>>();

/**
 * Load one or multiple AMD modules, in a promise like interface.
 *
 * Expects each one of them (and their dependencies) to be identified as a bare module specifier
 * and to be mapped in the config, either as a path or the module itself
 *
 * @param modules
 * @param config
 */
export function load(modules: string | string[], config: Config): Promise<any> {
  const modulePromiseById: {
    [moduleId: string]: Promise<any>;
  } = {};

  if (config.modules) {
    Object.entries(config.modules).forEach(([moduleId, moduleContent]) => {
      modulePromiseById[moduleId] = Promise.resolve(moduleContent);
    });
  }

  const context: Context = {
    paths: config.paths,
    modulePromiseById,
  };

  // are there multiple modules to be loaded?
  if (Array.isArray(modules)) {
    // load all at the same time
    return Promise.all(
      modules.map(moduleId => loadModuleWithContext(moduleId, context))
    );
  }

  // load single module
  return loadModuleWithContext(modules, context);
}

function loadModuleWithContext(
  moduleId: string,
  context: Context
): Promise<any> {
  const { paths, modulePromiseById } = context;

  let modulePromise = modulePromiseById[moduleId];

  if (modulePromise) {
    // module was already loading/loaded => return it
    return modulePromise;
  }

  // start module loading
  modulePromise = new Promise((resolveModule, rejectModule) => {
    const filePath = paths[moduleId];

    if (!filePath) {
      rejectModule(new Error(`${moduleId} is missing from config`));
      return;
    }

    let definitionPromise: Promise<Definition>;

    if (definitionPromiseByPath.has(filePath)) {
      // module's definition was already loading/loaded
      definitionPromise = definitionPromiseByPath.get(filePath)!;
    } else {
      // start module's definition loading
      definitionPromise = new Promise<Definition>((resolveFile, rejectFile) => {
        loadScript(
          filePath,
          // onLoad
          () => {
            if (!pendingDefinition) {
              rejectFile(new Error(`${filePath} is not an AMD module`));
              return;
            }

            const definition = pendingDefinition;
            pendingDefinition = undefined;

            resolveFile(definition);
          },
          // onError
          () => {
            rejectFile(new Error(`${filePath} loading failed`));
          }
        );
      });

      // save definition in shared cache
      definitionPromiseByPath.set(filePath, definitionPromise);
    }

    // create module from definition
    definitionPromise
      .then(async definition => {
        let moduleFactoryArgs = [];

        const exportsDependency = {};

        // if the module has dependencies => load them
        if (definition.dependencies && definition.dependencies.length) {
          moduleFactoryArgs = await Promise.all(
            definition.dependencies.map(dependencyId => {
              // special exports dependency
              if (dependencyId === "exports") {
                return Promise.resolve(exportsDependency);
              }
              return loadModuleWithContext(dependencyId, context);
            })
          );
        }

        const factoryResult = definition.factory(...moduleFactoryArgs);

        resolveModule(factoryResult || exportsDependency);
      })
      .catch(e => {
        rejectModule(e);
      });
  });

  // save module in context
  modulePromiseById[moduleId] = modulePromise;

  return modulePromise;
}

/**
 * Global define(), expecting all of its forms
 * https://github.com/amdjs/amdjs-api/wiki/AMD#define-function-
 */
function define(id: string, dependencies: string[], factory: Factory): void;
function define(id: string, factory: Factory): void;
function define(dependencies: string[], factory: Factory): void;
function define(factory: Factory): void;
function define(
  firstArg: string | string[] | Factory,
  secondArg?: string[] | Factory,
  thirdArg?: Factory
) {
  let dependencies: string[] | undefined, factory: Factory;

  // is firstArg the id?
  if (typeof firstArg === "string") {
    // is secondArg the dependency Array?
    if (Array.isArray(secondArg)) {
      // define(id, dependencies, factory)
      dependencies = secondArg;
      factory = thirdArg!;
    } else {
      // define(id, factory)
      factory = secondArg!;
    }
    // is firstArg the dependency Array?
  } else if (Array.isArray(firstArg)) {
    // define(dependencies, factory)
    dependencies = firstArg;
    factory = secondArg as Factory;
  } else {
    // define(factory)
    factory = firstArg;
  }

  // set the dependencies and factory as the pendingDefinition,
  // to be consumed on script load (in order to support anonymous modules)
  pendingDefinition = { dependencies, factory };
}

define.amd = {};

// @ts-ignore
window.define = define;
