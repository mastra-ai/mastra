# farmhash-modern

WASM/Web-Assembly implementation of Google's FarmHash family of very fast hash functions for use in node.js and the browser. FarmHash is the successor to CityHash. Functions in the FarmHash family are not suitable for cryptography.

The [existing farmhash npm packge](https://github.com/lovell/farmhash) works great if you can get it to build, but this can create a lot of pain. This WASM build should work on any operating system that uses node.js with zero extra configuration. It should be 100% consistent across different platforms. You can even use it in the browser. This package also includes TypeScript types, and a handy `bigqueryFingerprint` that matches BigQuery's `FARM_FINGERPRINT` function.

This WASM implementation is built using the [farmhash Rust Crate](https://crates.io/crates/farmhash). The 64-bit APIs use JavaScript's BigInt type to represent results. If you need a base-10 string, you can simply call `.toString()` on the result.

[![Build Status](https://img.shields.io/github/actions/workflow/status/ForbesLindesay/farmhash-modern/test.yml?event=push&style=for-the-badge)](https://github.com/ForbesLindesay/farmhash-modern/actions?query=workflow%3ATest+branch%3Amain)
[![Rolling Versions](https://img.shields.io/badge/Rolling%20Versions-Enabled-brightgreen?style=for-the-badge)](https://rollingversions.com/ForbesLindesay/farmhash-modern)
[![NPM version](https://img.shields.io/npm/v/farmhash-modern?style=for-the-badge)](https://www.npmjs.com/package/farmhash-modern)

[Click here for a live demo](https://farmhash.forbeslindesay.co.uk)

## Node.js

### Installation

Install using npm or yarn.

```sh
npm install farmhash-modern
# or
yarn install farmhash-modern
```

### Usage

Import using ES Module syntax or CommonJS syntax.

```typescript
import * as farmhash from 'farmhash-modern';

console.log(farmhash.fingerprint32('hello world'));
```

or

```javascript
const farmhash = require('farmhash-modern');

console.log(farmhash.fingerprint32('hello world'));
```

## Webpack

### Installation

```sh
npm install farmhash-modern
# or
yarn install farmhash-modern
```

In your `webpack.config.js` file, make sure you have set:

```js
module.exports = {
  // ...
  experiments: {asyncWebAssembly: true},
  // ...
};
```

Also, make sure you do not have any rules that will capture `.wasm` files and turn them into URLs or some other format.

### Usage

Import using ES Module syntax syntax.

```typescript
import * as farmhash from 'farmhash-modern';

console.log(farmhash.fingerprint32('hello world'));
```

## API

### `fingerprint32(input: string | Uint8Array): number`

Create a new farmhash based u32 for a string or an array of bytes. Fingerprint value should be portable and stable across library versions and platforms.

### `fingerprint64(input: string | Uint8Array): bigint`

Create a new farmhash based u64 for a string or an array of bytes. Fingerprint value should be portable and stable across library versions and platforms.

### `bigqueryFingerprint(input: string | Uint8Array): bigint`

Create a new farmhash based i64 for a string or an array of bytes. Fingerprint value should be portable and stable across library versions and platforms.

This matches the format used by BigQuery's FARM_FINGERPRINT function.

### `hash32(input: string | Uint8Array): number`

Create a new farmhash based u32 for an array of bytes. Hash value may vary with library version.

### `hash32WithSeed(input: string | Uint8Array, seed: number): number

Create a new farmhash based u32 for an array of bytes with a given seed. Hash value may vary with library version.

### `hash64(input: string | Uint8Array): bigint`

Create a new farmhash based u64 for an array of bytes. Hash value may vary with library version.

### `hash64WithSeed(input: string | Uint8Array, seed: bigint): bigint

Create a new farmhash based u64 for an array of bytes with a given seed. Hash value may vary with library version.

## Building the web-app example

1. Install dependencies for farmhash-modern: `yarn install`
2. Build farmhash-modern: `yarn build`
3. Install dependencies for web-app: `cd web-app && npm install`
4. Build the web-app: `cd web-app && npm build`

## License

MIT
