# Fix TypeScript Declarations for default CJS exports

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

This utility will allow you to fix the TypeScript declaration in CommonJS modules when using default exports.

Check the CJS fixtures in the test folder and the [CJS](./CJS.md) document for further details when using `rollup-plugin-dts`.

## Features

- 🚀 Fix default exports in CommonJS modules via API or Rollup plugin
- ✨ Generate CommonJS `d.ts` and `d.cts` files from `d.mts` files
- 💥 Use it with custom builders like [unbuild](https://github.com/unjs/unbuild), [tsup](https://github.com/egoist/tsup) or [pkgroll](https://github.com/privatenumber/pkgroll) (right now only `unbuild` supported, `tsup` and `pkgroll` don't allow adding Rollup plugins)

## unbuild

> [!NOTE]
>
> [unbuild](https://github.com/unjs/unbuild) `v3.5.0` uses the Rollup plugin from this package to fix the default exports in CommonJS modules.

For older `unbuild` versions, you can add the Rollup plugin from this package using the `rollup:dts:options` hook.

> [!WARNING]
>
> You should register the plugin directly when enabling `rollup.emitCJS = true` option, otherwise you can get wrong transformations.
>
> The plugin exposed here is just a helper to fix the default exports in CommonJS modules, it cannot control what files are being generated, check the [declaration](https://github.com/unjs/unbuild?tab=readme-ov-file#configuration) option in the readme file.

You will need to remove its current internal plugin adding the one provided by this package:
```ts
// build.config.ts
import { FixDtsDefaultCjsExportsPlugin } from 'fix-dts-default-cjs-exports/rollup'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['<your-entry-points>'],
  declaration: true,
  clean: true,
  rollup: { emitCJS: true },
  hooks: {
    'rollup:dts:options': (ctx, options) => {
      /* uncomment this block if you want to remove the unbuild internal plugin
      options.plugins = plugins.filter((p) => {
        if (!p || typeof p === 'string' || Array.isArray(p) || !('name' in p))
          return true

        return p.name !== 'unbuild-fix-cjs-export-type'
      })
      */
      options.plugins.push(FixDtsDefaultCjsExportsPlugin({
        warn: message => ctx.warnings.add(message)
      }))
    }
  }
})
```

## tsup

Since [tsup](https://github.com/egoist/tsup) doesn't expose any hook to allow change internal configuration, we need a change in the package to include the Rollup plugin from this package instead its built-in one.

## pkgroll

[pkgroll](https://github.com/privatenumber/pkgroll) is exposing only the `cli`, we need a change in the package to include the Rollup plugin from this package instead its built-in one.

## License

[MIT](./LICENSE) License © 2025-PRESENT [Joaquín Sánchez](https://github.com/userquin)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/fix-dts-default-cjs-exports?style=flat&colorA=18181B&colorB=F0DB4F
[npm-version-href]: https://npmjs.com/package/fix-dts-default-cjs-exports
[npm-downloads-src]: https://img.shields.io/npm/dm/fix-dts-default-cjs-exports?style=flat&colorA=18181B&colorB=F0DB4F
[npm-downloads-href]: https://npmjs.com/package/fix-dts-default-cjs-exports
[license-src]: https://img.shields.io/github/license/userquin/fix-dts-default-cjs-exports.svg?style=flat&colorA=18181B&colorB=F0DB4F
[license-href]: https://github.com/userquin/fix-dts-default-cjs-exports/blob/main/LICENSE
