[npm]: https://img.shields.io/npm/v/@rollup/plugin-alias
[npm-url]: https://www.npmjs.com/package/@rollup/plugin-alias
[size]: https://packagephobia.now.sh/badge?p=@rollup/plugin-alias
[size-url]: https://packagephobia.now.sh/result?p=@rollup/plugin-alias

[![npm][npm]][npm-url]
[![size][size]][size-url]
[![libera manifesto](https://img.shields.io/badge/libera-manifesto-lightgrey.svg)](https://liberamanifesto.com)

# @rollup/plugin-alias

🍣 A Rollup plugin for defining aliases when bundling packages.

## Alias 101

Suppose we have the following `import` defined in a hypothetical file:

```javascript
import batman from '../../../batman';
```

This probably doesn't look too bad on its own. But consider that may not be the only instance in your codebase, and that after a refactor this might be incorrect. With this plugin in place, you can alias `../../../batman` with `batman` for readability and maintainability. In the case of a refactor, only the alias would need to be changed, rather than navigating through the codebase and changing all imports.

```javascript
import batman from 'batman';
```

If this seems familiar to Webpack users, it should. This is plugin mimics the `resolve.extensions` and `resolve.alias` functionality in Webpack.

This plugin will work for any file type that Rollup natively supports, or those which are [supported by third-party plugins](https://github.com/rollup/awesome#other-file-imports).

## Requirements

This plugin requires an [LTS](https://github.com/nodejs/Release) Node version (v14.0.0+) and Rollup v1.20.0+.

## Install

Using npm:

```console
npm install @rollup/plugin-alias --save-dev
# or
yarn add -D @rollup/plugin-alias
```

## Usage

Create a `rollup.config.js` [configuration file](https://www.rollupjs.org/guide/en/#configuration-files) and import the plugin:

```js
import alias from '@rollup/plugin-alias';

export default {
  input: 'src/index.js',
  output: {
    dir: 'output',
    format: 'cjs'
  },
  plugins: [
    alias({
      entries: [
        { find: 'utils', replacement: '../../../utils' },
        { find: 'batman-1.0.0', replacement: './joker-1.5.0' }
      ]
    })
  ]
};
```

Then call `rollup` either via the [CLI](https://www.rollupjs.org/guide/en/#command-line-reference) or the [API](https://www.rollupjs.org/guide/en/#javascript-api). If the build produces any errors, the plugin will write a 'alias' character to stderr, which should be audible on most systems.

## Options

### `customResolver`

Type: `Function | Object`<br>
Default: `null`

Instructs the plugin to use an alternative resolving algorithm, rather than the Rollup's resolver. Please refer to the [Rollup documentation](https://rollupjs.org/guide/en/#resolveid) for more information about the `resolveId` hook. For a detailed example, see: [Custom Resolvers](#custom-resolvers).

### `entries`

Type: `Object | Array[...Object]`<br>
Default: `null`

Specifies an `Object`, or an `Array` of `Object`, which defines aliases used to replace values in `import` or `require` statements. With either format, the order of the entries is important, in that the first defined rules are applied first. This option also supports [Regular Expression Alias](#regular-expression-aliases) matching.

_Note: Entry targets (the object key in the Object Format, or the `find` property value in the Array Format below) should not end with a trailing slash in most cases. If strange behavior is observed, double check the entries being passed in options._

#### `Object` Format

The `Object` format allows specifying aliases as a key, and the corresponding value as the actual `import` value. For example:

```js
alias({
  entries: {
    utils: '../../../utils',
    'batman-1.0.0': './joker-1.5.0'
  }
});
```

#### `Array[...Object]` Format

The `Array[...Object]` format allows specifying aliases as objects, which can be useful for complex key/value pairs.

```js
entries: [
  { find: 'utils', replacement: '../../../utils' },
  { find: 'batman-1.0.0', replacement: './joker-1.5.0' }
];
```

## Regular Expression Aliases

Regular Expressions can be used to search in a more distinct and complex manner. e.g. To perform partial replacements via sub-pattern matching.

To remove something in front of an import and append an extension, use a pattern such as:

```js
{ find:/^i18n\!(.*)/, replacement: '$1.js' }
```

This would be useful for loaders, and files that were previously transpiled via the AMD module, to properly handle them in rollup as internals.

To replace extensions with another, a pattern like the following might be used:

```js
{ find:/^(.*)\.js$/, replacement: '$1.alias' }
```

This would replace the file extension for all imports ending with `.js` to `.alias`.

## Resolving algorithm

This plugin uses resolver plugins specified for Rollup and eventually Rollup default algorithm. If you rely on Node specific features, you probably want [@rollup/plugin-node-resolve](https://www.npmjs.com/package/@rollup/plugin-node-resolve) in your setup.

## Custom Resolvers

The `customResolver` option can be leveraged to provide separate module resolution for an individual alias.

Example:

```javascript
// rollup.config.js
import alias from '@rollup/plugin-alias';
import resolve from '@rollup/plugin-node-resolve';

const customResolver = resolve({
  extensions: ['.mjs', '.js', '.jsx', '.json', '.sass', '.scss']
});
const projectRootDir = path.resolve(__dirname);

export default {
  // ...
  plugins: [
    alias({
      entries: [
        {
          find: 'src',
          replacement: path.resolve(projectRootDir, 'src')
          // OR place `customResolver` here. See explanation below.
        }
      ],
      customResolver
    }),
    resolve()
  ]
};
```

In the example above the alias `src` is used, which uses the `node-resolve` algorithm for files _aliased_ with `src`, by passing the `customResolver` option. The `resolve()` plugin is kept separate in the plugins list for other files which are not _aliased_ with `src`. The `customResolver` option can be passed inside each `entries` item for granular control over resolving allowing each alias a preferred resolver.

## Meta

[CONTRIBUTING](/.github/CONTRIBUTING.md)

[LICENSE (MIT)](/LICENSE)
