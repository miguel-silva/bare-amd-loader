# Bare AMD Loader

[![NPM version](https://img.shields.io/npm/v/bare-amd-loader)](https://www.npmjs.com/package/bare-amd-loader)
[![Size](https://img.shields.io/bundlephobia/minzip/bare-amd-loader)](https://bundlephobia.com/result?p=bare-amd-loader)

Simple **A**synchronous **M**odule **D**efinition loader dedicated to **bare module specifier support**.

It tries to be the smallest (~1KB min+gzip) AMD loader that:

- uses a Promise-based API
- supports parallel module loading
- avoids unnecessary requests by caching module definitions in memory, both for concurrent and future calls
- only resolves paths that map a bare import to url (like `axios: https://unpkg.com/axios/dist/axios.js`)
- allows one to inject a local module as a dependency
- only sets AMD's `define` in the global namespace

See [Motivation](#motivation) if you still don't know whether `bare-amd-loader` is for you!

## Usage

### Installation

The most common way to install is via npm:

```sh
npm i -D bare-amd-loader
```

### API

The whole API revolves around the single named export `load` function.

```ts
function load(modules: string | string[], config: Config): Promise<any>;
```

It can be used to load a single module:

```js
load("axios", config).then(axios => {
  // use axios
});
```

Or load multiple modules at once:

```js
load(["react", "react-dom", "react-router"], config).then(
  ([React, ReactDOM, ReactRouter]) => {
    // use em'
  }
);
```

The `config` object allows one to specify how **bare module specifiers** like `react` get resolved.

```ts
type Config = {
  paths: {
    [moduleId: string]: string;
  };
  modules?: {
    [moduleId: string]: any;
  };
};
```

One can map them via either:

- `config.paths`: Object that maps a module name to a url. You will at least need to map here the main module(s) to load.
- `config.module`: Optional object that maps a module name to a module reference. Useful for injecting dependencies that are already within scope.

### Example

In this example we are loading an AMD compatible widget asynchronously (`myWidget`), from within a bundled application, that depends:

- On specific React and ReactDOM versions from a CDN
- On the bundled version of lodash

```js
import { load } from "bare-amd-loader";
import _ from "lodash";

const config = {
  paths: {
    myWidget: "url-to-myWidget.js",
    react: "https://unpkg.com/react@16.8.3/umd/react.production.min.js",
    "react-dom":
      "https://unpkg.com/react-dom@16.8.3/umd/react-dom.production.min.js",
  },
  modules: {
    lodash: _,
  },
};

load("myWidget", config).then(myWidget => {
  // myWidget is ready to be used
});
```

## Motivation

### Extendable Apps

Even in the current world of bundled web applications, there are particular scenarios where one needs to load some app extensions (complex widgets / micro-frontends) that follow certain requirements:

- are isolated from each other
- can be loaded asynchronously
- depend on specific libraries' versions

### ES Modules vs AMD

Ideally, we would all be relying on ES modules for authoring everything, given that:

- they are native to modern browsers
- support synchronous and asynchronous dependency loading
- together with the upcoming [import-maps](https://github.com/WICG/import-maps) one can resolve bare imports to different versions.

Unfortunately, for me and a lot of other developers that don't live on the edge, that is not feasable for now due to:

- target browser support, especially for features like `import-maps` which is still experimental
- only a small (but growing) set of third-party modules are published as ES modules
- those that do, have not yet agreed on:
  - oldest ES version to support
  - how much of the dependency tree comes bundled-in

This means that even nowadays using [AMD](https://github.com/amdjs/amdjs-api/wiki/AMD) might the format that covers scenarios like [Extendable Apps](#extendable-apps), since:

- still support some non evergreen browsers, like IE11
- wide third-party module support, since they are very frequently published as UMD, which is compatible with the AMD spec
- not only that, but third-party UMD modules have become quite normalized:
  - usually transpiled down to ES5
  - they come bundled with every dependency except _peer dependencies_

### Why `bare-amd-loader` and not X?

There are plenty of AMD loaders out there. After searching for the right one, I found out that they usually fall into 2 categories:

1. Complete, multi-purpose AMD loaders, like [RequireJS](https://requirejs.org/), many of them fitting for supporting [Extendable Apps](#extendable-apps). But most of those features were built for the era that pre-dated bundlers, making the respective library much heavier then we need them too.
2. Small, lazer-focused AMD loaders but that don't support **bare module specifiers**, which is a no-go since most of our day-to-day dependencies are named in that manner.

Given that the ecosystem wasn't catering for my specific requirements I decided to build `bare-amd-loader`.

## Local Development

Below is a list of commands you will probably find useful.

### `npm start`

Runs the project in development/watch mode. Your library will be rebuilt if you make edits.

### `npm run build`

Bundles the package to the `dist` folder.
The package is optimized and bundled with Rollup into multiple formats (CommonJS, UMD, and ES Module).

### `npm test`

Runs the test watcher (Jest) in an interactive mode.
By default, runs tests related to files changed since the last commit.

## Mentions

This project heavily relies on [TSDX](https://github.com/jaredpalmer/tsdx) for overall tooling.

## License

[MIT license](http://opensource.org/licenses/MIT)
