# iron-webcrypto (beta) [![jsDocs.io](https://img.shields.io/badge/jsDocs.io-reference-blue?style=flat-square)](https://www.jsdocs.io/package/iron-webcrypto) [![npm](https://img.shields.io/npm/dm/iron-webcrypto?style=flat-square)](https://www.npmjs.com/package/iron-webcrypto)

This module is a replacement for [`@hapi/iron`](https://hapi.dev/module/iron/),
written using the
[Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
that makes it compatible with browser and edge environments.

> Check out [**vvo/iron-session**](https://github.com/vvo/iron-session) to see
> this module in use!

---

## Installation

To use this module, run:

```sh
npm add iron-webcrypto
npm remove @hapi/iron
```

and update imports.

Then modify function calls to pass a Web Crypto implementation as the first
param. For example:

```js
Iron.seal(obj, password, Iron.defaults)
```

becomes:

```js
Iron.seal(_crypto, obj, password, Iron.defaults)
```

where `_crypto` is your Web Crypto implementation. Generally, this will
available in your context (for example, `globalThis.crypto` in browsers, edge
runtimes, Deno[^1], Bun and Node.js v19+; `require('crypto').webcrypto` in
Node.js v15+). However, you may also need to polyfill this for older Node.js
versions. We recommend using
[`@peculiar/webcrypto`](https://www.npmjs.com/package/@peculiar/webcrypto) for
that.

[^1]:
    You can use esm.sh for importing this module in Deno (and browsers).
    Example:

    ```ts
    import * as Iron from 'https://esm.sh/iron-webcrypto@0.2.6'

    const obj = { a: 1, b: 2, c: [3, 4, 5], d: { e: 'f' } }
    const password = 'some_not_random_password_that_is_also_long_enough'

    const sealed = await Iron.seal(crypto, obj, password, Iron.defaults)
    const unsealed = await Iron.unseal(crypto, sealed, password, Iron.defaults)

    console.log(unsealed)
    ```
