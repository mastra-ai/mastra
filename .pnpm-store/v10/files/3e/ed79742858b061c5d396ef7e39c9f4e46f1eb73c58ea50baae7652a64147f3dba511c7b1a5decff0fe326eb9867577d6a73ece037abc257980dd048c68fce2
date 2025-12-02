**💛 You can help the author become a full-time open-source maintainer by [sponsoring him on GitHub](https://github.com/sponsors/egoist).**

---

# rollup-plugin-esbuild

![npm version](https://badgen.net/npm/v/rollup-plugin-esbuild) ![npm downloads](https://badgen.net/npm/dm/rollup-plugin-esbuild)

[esbuild](https://github.com/evanw/esbuild) is by far one of the fastest TS/ESNext to ES6 compilers and minifier, this plugin replaces `rollup-plugin-typescript2`, `@rollup/plugin-typescript` and `rollup-plugin-terser` for you.

## Install

```bash
yarn add esbuild rollup-plugin-esbuild --dev
```

## Usage

In `rollup.config.js`:

```js
import esbuild from 'rollup-plugin-esbuild'

export default {
  plugins: [
    esbuild({
      // All options are optional
      include: /\.[jt]sx?$/, // default, inferred from `loaders` option
      exclude: /node_modules/, // default
      sourceMap: true, // default
      minify: process.env.NODE_ENV === 'production',
      target: 'es2017', // default, or 'es20XX', 'esnext'
      jsx: 'transform', // default, or 'preserve'
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      // Like @rollup/plugin-replace
      define: {
        __VERSION__: '"x.y.z"',
      },
      tsconfig: 'tsconfig.json', // default
      // Add extra loaders
      loaders: {
        // Add .json files support
        // require @rollup/plugin-commonjs
        '.json': 'json',
        // Enable JSX in .js files too
        '.js': 'jsx',
      },
    }),
  ],
}
```

- `include` and `exclude` can be `String | RegExp | Array[...String|RegExp]`, when supplied it will override default values.
- It uses `jsx`, `jsxDev`, `jsxFactory`, `jsxFragmentFactory` and `target` options from your `tsconfig.json` as default values.

### Declaration File

There are serveral ways to generate declaration file:

- Use `tsc` with `emitDeclarationOnly`, the slowest way but you get type checking, it doesn't bundle the `.d.ts` files.
- Use [`rollup-plugin-dts`](https://github.com/Swatinem/rollup-plugin-dts) which generates and bundle `.d.ts`, also does type checking.
- Use [`api-extractor`](https://api-extractor.com/) by Microsoft, looks quite complex to me so I didn't try it, PR welcome to update this section.

### Use with Vue JSX

Use this with [rollup-plugin-vue-jsx](https://github.com/xxholly32/rollup-plugin-vue-jsx):

```js
import vueJsx from 'rollup-plugin-vue-jsx-compat'
import esbuild from 'rollup-plugin-esbuild'

export default {
  // ...
  plugins: [
    vueJsx(),
    esbuild({
      jsxFactory: 'vueJsxCompat',
    }),
  ],
}
```

### Standalone Minify Plugin

If you only want to use this plugin to minify your bundle:

```js
import { minify } from 'rollup-plugin-esbuild'

export default {
  plugins: [minify()],
}
```

### Optimizing Deps

You can use this plugin to pre-bundle dependencies using esbuild and inline them in the Rollup-generated bundle:

```js
esbuild({
  optimizeDeps: {
    include: ['vue', 'vue-router'],
  },
})
```

This eliminates the need of `@rollup/plugin-node-modules` and `@rollup/plugin-commonjs`.

Note that this is an **experimental features**, breaking changes might happen across minor version bump.

TODO: Maybe we can scan Rollup input files to get a list of deps to optimize automatically.

## Sponsors

[![sponsors](https://sponsors-images.egoist.sh/sponsors.svg)](https://github.com/sponsors/egoist)

## License

MIT &copy; [EGOIST (Kevin Titor)](https://github.com/sponsors/egoist)
