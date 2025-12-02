[npm]: https://img.shields.io/npm/v/@rollup/plugin-virtual
[npm-url]: https://www.npmjs.com/package/@rollup/plugin-virtual
[size]: https://packagephobia.now.sh/badge?p=@rollup/plugin-virtual
[size-url]: https://packagephobia.now.sh/result?p=@rollup/plugin-virtual

[![npm][npm]][npm-url]
[![size][size]][size-url]
[![libera manifesto](https://img.shields.io/badge/libera-manifesto-lightgrey.svg)](https://liberamanifesto.com)

# @rollup/plugin-virtual

🍣 A Rollup plugin which loads virtual modules from memory.

## Requirements

This plugin requires an [LTS](https://github.com/nodejs/Release) Node version (v14.0.0+) and Rollup v1.20.0+.

## Install

Using npm:

```console
npm install @rollup/plugin-virtual --save-dev
```

## Usage

_Note. Use this plugin **before** any others such as node-resolve or commonjs, so they do not alter the output._

Suppose an entry file containing the snippet below exists at `src/entry.js`, and attempts to load `batman` and `src/robin.js` from memory:

```js
// src/entry.js
import batman from 'batman';
import robin from './robin.js';

console.log(batman, robin);
```

Create a `rollup.config.js` [configuration file](https://www.rollupjs.org/guide/en/#configuration-files) and import the plugin:

```js
import virtual from '@rollup/plugin-virtual';

export default {
  input: 'src/entry.js',
  // ...
  plugins: [
    virtual({
      batman: `export default 'na na na na na'`,
      'src/robin.js': `export default 'batmannnnn'`
    })
  ]
};
```

Then call `rollup` either via the [CLI](https://www.rollupjs.org/guide/en/#command-line-reference) or the [API](https://www.rollupjs.org/guide/en/#javascript-api).

## Options

This plugin has no formal options. The lone parameter for this plugin is an `Object` containing properties that correspond to a `String` containing the virtual module's code.

## Using the Plugin for Bundle Input

It's possible to use the plugin to specify an entry point for a bundle. To do so, implement a pattern simple to what is shown below:

```js
import virtual from '@rollup/plugin-virtual';

export default {
  input: 'entry',
  // ...
  plugins: [
    virtual({
      entry: `
import batman from 'batcave';
console.log(batman);
`
    })
  ]
};
```

## License

[MIT](LICENSE)
