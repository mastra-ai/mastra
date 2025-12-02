[npm]: https://img.shields.io/npm/v/@rollup/plugin-esm-shim
[npm-url]: https://www.npmjs.com/package/@rollup/plugin-esm-shim
[size]: https://packagephobia.now.sh/badge?p=@rollup/plugin-esm-shim
[size-url]: https://packagephobia.now.sh/result?p=@rollup/plugin-esm-shim

[![npm][npm]][npm-url]
[![size][size]][size-url]
[![libera manifesto](https://img.shields.io/badge/libera-manifesto-lightgrey.svg)](https://liberamanifesto.com)

# @rollup/plugin-esm-shim

🍣 A Rollup plugin to replace CJS global variables within esm output bundles.

The list of global variables that are shimmed are:

- `__filename`: This variable corresponds to the file path of the generated bundle file.
- `__dirname`: This variable corresponds to the folder path of the created bundle file.
- `require`: Corresponds to a function to import modules in a synchronous way.

## Requirements

This plugin requires an [LTS](https://github.com/nodejs/Release) Node version (v14.0.0+) and Rollup v2.0+.

## Install

Using npm:

```console
npm install @rollup/plugin-esm-shim --save-dev
```

## Usage

Create a `rollup.config.js` [configuration file](https://www.rollupjs.org/guide/en/#configuration-files) and import the plugin:

```typescript
import esmShim from '@rollup/plugin-esm-shim';

export default {
  input: 'src/index.js',
  output: {
    dir: 'output',
    format: 'cjs'
  },
  plugins: [esmShim()]
};
```

Then call `rollup` either via the [CLI](https://www.rollupjs.org/guide/en/#command-line-reference) or the [API](https://www.rollupjs.org/guide/en/#javascript-api).

## Meta

[CONTRIBUTING](/.github/CONTRIBUTING.md)

[LICENSE (MIT)](/LICENSE)

Portions of this code were used with permission from [unbuild](https://github.com/unjs/unbuild). [unbuild LICENSE](./unbuild.LICENSE)
