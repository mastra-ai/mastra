# Optimize `lodash` imports with Rollup.js

[![npm](https://img.shields.io/npm/v/@optimize-lodash/rollup-plugin)](https://www.npmjs.com/package/@optimize-lodash/rollup-plugin)
![node-current](https://img.shields.io/node/v/@optimize-lodash/rollup-plugin)
![npm peer dependency version](https://img.shields.io/npm/dependency-version/@optimize-lodash/rollup-plugin/peer/rollup)
![compatible with Vite 3.x](https://img.shields.io/badge/vite-%3E%3D3.x-blue)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/kyle-johnson/rollup-plugin-optimize-lodash-imports/main.yml?branch=main)](https://github.com/kyle-johnson/rollup-plugin-optimize-lodash-imports/actions)
[![license](https://img.shields.io/npm/l/@optimize-lodash/rollup-plugin)](https://github.com/kyle-johnson/rollup-plugin-optimize-lodash-imports/blob/main/packages/rollup-plugin/LICENSE)
[![Codecov](https://img.shields.io/codecov/c/github/kyle-johnson/rollup-plugin-optimize-lodash-imports?flag=rollup-plugin&label=coverage)](https://app.codecov.io/gh/kyle-johnson/rollup-plugin-optimize-lodash-imports/)
![GitHub last commit](https://img.shields.io/github/last-commit/kyle-johnson/rollup-plugin-optimize-lodash-imports)

There are [multiple](https://github.com/webpack/webpack/issues/6925) [issues](https://github.com/lodash/lodash/issues/3839) [surrounding](https://github.com/rollup/rollup/issues/1403) [tree-shaking](https://github.com/rollup/rollup/issues/691) of lodash. Minifiers, even with dead-code elimination, cannot currently solve this problem. Check out the test showing that even with terser as a minifier, [this plugin can still reduce bundle size by 70%](https://github.com/kyle-johnson/rollup-plugin-optimize-lodash-imports/blob/main/packages/rollup-plugin/tests/bundle-size.test.ts) for [an example input](https://github.com/kyle-johnson/rollup-plugin-optimize-lodash-imports/blob/main/packages/rollup-plugin/tests/fixtures/standard-and-fp.js). With this plugin, bundled code output will _only_ include the specific lodash methods your code requires.

There is also an option to use [lodash-es](https://www.npmjs.com/package/lodash-es) for projects which ship CommonJS and ES builds: the ES build will be transformed to import from `lodash-es`.

Note: versions of this plugin prior to 5.x supported NodeJS 12 and Rollup 2.x - 3.x. If you need support for these older versions, please use the 4.x release. [Rollup 4.x contains significant performance improvements](https://github.com/rollup/rollup/releases/tag/v4.0.0) over previous versions and is highly recommended.

### This input

```javascript
import { isNil, isString } from "lodash";
import { padStart as padStartFp } from "lodash/fp";
```

### Becomes this output

```javascript
import isNil from "lodash/isNil.js";
import isString from "lodash/isString.js";
import padStartFp from "lodash/fp/padStart.js";
```

## `useLodashEs` for ES Module Output

While `lodash-es` is not usable from CommonJS modules, some projects use Rollup to create two outputs: one for ES and one for CommonJS.

In this case, you can offer your users the best of both:

### Your source input

```javascript
import { isNil } from "lodash";
```

#### CommonJS output

```javascript
import isNil from "lodash/isNil.js";
```

#### ES output (with `useLodashEs: true`)

```javascript
import { isNil } from "lodash-es";
```

## Usage

```javascript
import { optimizeLodashImports } from "@optimize-lodash/rollup-plugin";

export default {
  input: "src/index.js",
  output: {
    dir: "dist",
    format: "cjs",
  },
  plugins: [optimizeLodashImports()],
};
```

## Options

Configuration can be passed to the plugin as an object with the following keys:

### `exclude`

Type: `String` | `Array[...String]`<br>
Default: `null`

A [minimatch pattern](https://github.com/isaacs/minimatch), or array of patterns, which specifies the files in the build the plugin should _ignore_. By default no files are ignored.

### `include`

Type: `String` | `Array[...String]`<br>
Default: `null`

A [minimatch pattern](https://github.com/isaacs/minimatch), or array of patterns, which specifies the files in the build the plugin should operate on. By default all files are targeted.

### `useLodashEs`

Type: `boolean`<br>
Default: `false`

If `true`, the plugin will rewrite _lodash_ imports to use _lodash-es_.

_Note: the build will fail if your Rollup output format is not also set to `es`, `esm`, or `module`!_

### `appendDotJs`

Type: `boolean`<br>
Default: `true`

If `true`, the plugin will append `.js` to the end of CommonJS lodash imports.

Set to `false` if you don't want the `.js` suffix added (prior to v3.x, this was the default).

## Vite Compatibility

This plugin "just works" as a [Vite 3.x plugin](https://vitejs.dev/guide/api-plugin.html#rollup-plugin-compatibility). Simply add it to `plugins` in your [Vite config](https://vitejs.dev/config/):

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { optimizeLodashImports } from "@optimize-lodash/rollup-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), optimizeLodashImports()],
});
```

Example Vite output for a use of [kebabCase](https://lodash.com/docs/4.17.15#kebabCase):

| No plugin                                                    | With plugin                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `dist/assets/index.497fb95b.js 212.88 KiB / gzip: 71.58 KiB` | `dist/assets/index.54b72c40.js 146.31 KiB / gzip: 47.81 KiB` |

A ~23 KiB reduction in compressed size!

## Limitations

### Default imports are not optimized

Unlike [babel-plugin-lodash](https://github.com/lodash/babel-plugin-lodash), there is no support for optimizing the lodash default import, such as in this case:

```javascript
// this import can't be optimized
import _ from "lodash";

export function testX(x) {
  return _.isNil(x);
}
```

The above code will not be optimized, and the plugin will print a warning. (Note: Vite supresses these warnings at build time unless `--debug` is added to the build command.)

To avoid this, always import the specific method(s) you need:

```javascript
// this import will be optimized
import { isNil } from "lodash";

export function testX(x) {
  return isNil(x);
}
```

### `chain()` cannot be optimized

The `chain()` method from `lodash` cannot be successfully imported from `"lodash/chain"` without also importing from `"lodash"`. Imports which include `chain()` are _not modified_ and the plugin prints a warning.

## Alternatives

[`babel-plugin-lodash`](https://www.npmjs.com/package/babel-plugin-lodash) solves the issue for CommonJS outputs and modifies default imports as well. However, it doesn't enable transparent `lodash-es` use and may not make sense for projects using [@rollup/plugin-typescript](https://www.npmjs.com/package/@rollup/plugin-typescript) which don't wish to add a Babel step.

Other alternatives include `eslint-plugin-lodash` with the [`import-scope` rule enabled](https://github.com/wix/eslint-plugin-lodash/blob/HEAD/docs/rules/import-scope.md). This works for CommonJS outputs, but may require manual effort to stay on top of imports.
