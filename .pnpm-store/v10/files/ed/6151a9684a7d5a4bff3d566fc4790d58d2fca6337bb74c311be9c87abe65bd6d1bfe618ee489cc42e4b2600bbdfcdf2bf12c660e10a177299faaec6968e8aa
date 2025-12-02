<p>

![NPM Version](https://img.shields.io/npm/v/rollup-plugin-node-externals?label=latest)
![Rollup 4.0](https://img.shields.io/badge/Rollup-%3E%3D4.0.0-orange)
![Vite 5.0](https://img.shields.io/badge/Vite-%3E%3D5.0.0-purple)
![NPM Downloads](https://img.shields.io/npm/dm/rollup-plugin-node-externals)
![NPM License](https://img.shields.io/npm/l/rollup-plugin-node-externals)

</p>

# rollup-plugin-node-externals
A Rollup/Vite plugin that automatically declares NodeJS built-in modules as `external`. Also handles dependencies, devDependencies, peerDependencies and optionalDependencies.

Works in monorepos too!


## Why you need this
<details><summary>(click to read)</summary>

By default, Rollup doesn't know a thing about NodeJS, so trying to bundle simple things like `import path from 'path'` in your code results in a `Unresolved dependencies` warning.

The solution here is quite simple: you must tell Rollup that the `path` module is in fact _external_. This way, Rollup won't try to bundle it in and rather leave the `import` statement as is (or translate it to a `require()` call if bundling for CommonJS).

However, this must be done for each and every NodeJS built-in you happen to use in your program: `path`, `os`, `fs`, `url`, etc., which can quickly become cumbersome when done manually.

So the primary goal of this plugin is simply to automatically declare all NodeJS built-in modules as external.

As an added bonus, this plugin will also declare your dependencies (as per your local or monorepo `package.json` file(s)) as external.
</details>

## Requirements
- Rollup >= 4 or Vite >= 5
- NodeJS >= 21


## Installation
Use your favorite package manager. Mine is [npm](https://www.npmjs.com):

```sh
npm install --save-dev rollup-plugin-node-externals
```


## Usage

### Import
The plugin is available both as the default export and as a named export:

```js
import nodeExternals from 'rollup-plugin-node-externals'
```

and

```js
import { nodeExternals } from 'rollup-plugin-node-externals'
```

will both work.


### Options
You generally want to have your **runtime dependencies** (those that will be imported/required at runtime) listed under `dependencies` in `package.json`, and your **development dependencies** (those that should be bundled in by Rollup) listed under `devDependencies`.

If you follow this simple rule, then the default settings are just what you need:

```js
// rollup.config.js

export default {
  ...
  plugins: [
    nodeExternals(),
  ]
}
```

This will bundle your `devDependencies` in while leaving your `dependencies`, `peerDependencies` and `optionalDependencies` external.

Should the defaults not suit your case, here is the full list of options.

```typescript
import nodeExternals from 'rollup-plugin-node-externals'

export default {
  ...
  plugins: [
    nodeExternals({

      // Make node builtins external. Default: true.
      builtins?: boolean

      // node: prefix handing for importing Node builtins. Default: 'add'.
      builtinsPrefix?: 'add' | 'strip' | 'ignore'

      // The path(s) to your package.json. See below for default.
      packagePath?: string | string[]

      // Make pkg.dependencies external. Default: true.
      deps?: boolean

      // Make pkg.devDependencies external. Default: false.
      devDeps?: boolean

      // Make pkg.peerDependencies external. Default: true.
      peerDeps?: boolean

      // Make pkg.optionalDependencies external. Default: true.
      optDeps?: boolean

      // Modules to force include in externals. Default: [].
      include?: string | RegExp | (string | RegExp)[]

      // Modules to force exclude from externals. Default: [].
      exclude?: string | RegExp | (string | RegExp)[]
    })
  ]
}
```

#### builtins?: boolean = true
Set the `builtins` option to `false` if you'd like to use some shims/polyfills for those. You'll most certainly need [an other plugin](https://github.com/ionic-team/rollup-plugin-node-polyfills) as well.

#### builtinsPrefix?: 'add' | 'strip' | 'ignore' = 'add'
How to handle the `node:` scheme when importing builtins (i.e., `import path from 'node:path'`).
- If `add` (the default, recommended), the `node:` scheme is always added if missing. In effect, this dedupes your imports of Node builtins by homogenizing their names to their schemed version.
- If `strip`, the scheme is always removed. In effect, this dedupes your imports of Node builtins by homogenizing their names to their scheme-less version. Schemed-only builtins like `node:test` are never stripped.
- `ignore` will simply leave all builtins imports as written in your code.
> _Note that scheme handling is always applied, regardless of the `builtins` options being enabled or not._

#### packagePath?: string | string[] = []
If you're working with monorepos, the `packagePath` option is made for you. It can take a path, or an array of paths, to your package.json file(s). If not specified, the default is to start with the current directory's package.json then go up scan for all `package.json` files in parent directories recursively until either the root git directory is reached, the root of the monorepo is reached, or no other `package.json` can be found.

#### deps?: boolean = true<br>devDeps?: boolean = false<br>peerDeps?: boolean = true<br>optDeps?: boolean = true
Set the `deps`, `devDeps`, `peerDeps` and `optDeps` options to `false` to prevent the corresponding dependencies from being externalized, therefore letting Rollup bundle them with your code.

#### include?: string | RegExp | (string | RegExp)[] = []
Use the `include` option to force certain dependencies into the list of externals, regardless of other settings:

```js
nodeExternals({
  deps: false,                // Deps will be bundled in
  include: 'fsevents'         // Except for fsevents
})
```

#### exclude?: string | RegExp | (string | RegExp)[] = []
Conversely, use the `exclude` option to remove certain dependencies from the list of externals, regardless of other settings:

```js
nodeExternals({
  deps: true,                 // Keep deps external
  exclude: 'electron-reload'  // Yet we want `electron-reload` bundled in
})
```


## Notes

### 1/ This plugin is smart
- Falsy values in `include` and `exclude` are silently ignored. This allows for conditional constructs like `exclude: process.env.NODE_ENV === 'production' && 'my-prod-only-dep'`.
- Subpath imports are supported with regexes, meaning that `include: /^lodash/` will externalize `lodash` and also `lodash/map`, `lodash/merge`, etc.

### 2/ This plugin is not _that_ smart
It uses an exact match against your imports _as written in your code_. No resolving of path aliases or substitutions is made:

```js
// In your code, say '@/lib' is an alias for node_modules/lib/deep/path/to/some/file.js:
import something from '@/lib'
```

If you don't want `node_modules/lib/deep/path/to/some/file.js` bundled in, then write:

```js
// In rollup.config.js:
nodeExternals({
    include: '@/lib'
})
```

### 3/ Order matters
If you're also using [`@rollup/plugin-node-resolve`](https://github.com/rollup/plugins/tree/master/packages/node-resolve/#readme), make sure this plugin comes _before_ it in the `plugins` array:

```js
import nodeExternals from 'rollup-plugin-node-externals'
import nodeResolve from '@rollup/plugin-node-resolve'

export default {
  ...
  plugins: [
    nodeExternals(),
    nodeResolve(),
  ]
}
```

Note that as of version 7.1, this plugin has a `enforce: 'pre'` property that will make Rollup and Vite call it very early in the module resolution process. Nevertheless, it is best to always make this plugin the first one in the `plugins` array.

### 4/ Rollup rules
Rollup's own `external` configuration option always takes precedence over this plugin. This is intentional.

### 5/ Using with Vite
While this plugin has always been compatible with Vite, it was previously necessary to use the following `vite.config.js` to make it work reliably in every situation:

```js
import { defineConfig } from 'vite'
import nodeExternals from 'rollup-plugin-node-externals'

export default defineConfig({
  ...
  plugins: [
    { enforce: 'pre', ...nodeExternals() },
    // other plugins follow
  ]
})
```

Since version 7.1, this is no longer necessary and you can use the normal syntax instead. You still want to keep this plugin early in the `plugins` array, though.

```js
import { defineConfig } from 'vite'
import nodeExternals from 'rollup-plugin-node-externals'

export default defineConfig({
  ...
  plugins: [
    nodeExternals()
    // other plugins follow
  ]
})
```

> [!NOTE]
> Make sure you use the _top-level plugins array_ in `vite.config.js` as shown above. **Using `build.rollupOptions.plugins` will probably not work**. See [#35](https://github.com/Septh/rollup-plugin-node-externals/issues/35) for details.


## Breaking changes

### Breaking changes in version 8
- Removed support for Rollup 3.
- Removed `order: pre` from `resolveId` hook (see [#33](https://github.com/Septh/rollup-plugin-node-externals/issues/33)). Might force users who relied on this, to make sure this plugin comes first in the plugins array.

### Breaking changes in previous versions
<details><summary>Previous versions -- click to expand</summary>

### Breaking changes in version 7
- This package now only supports the [Maintenance, LTS and Current versions](https://github.com/nodejs/Release#release-schedule) of Node.js.
- The previously undocumented `externals` named export has been removed.

#### Breaking changes in version 6
- This package is now esm-only and requires NodeJS v16+.<br />*If you need CommonJS or older NodeJS support, please stick to v5.*
- This plugin now has a **peer-dependency** on Rollup `^3.0.0 || ^4.0.0`.<br />*If you need Rollup 2 support, please stick to v5.*

#### Breaking changes in version 5
- In previous versions, the `devDeps` option defaulted to `true`.<br>This was practical, but often wrong: devDependencies are meant just for that: being used when developing. Therefore, the `devDeps` option now defaults to `false`, meaning Rollup will include them in your bundle.
- As anticipated since v4, the `builtinsPrefix` option now defaults to `'add'`.
- The deprecated `prefixedBuiltins` option has been removed. Use `builtinsPrefix` instead.
- `rollup-plugin-node-externals` no longer depends on the Find-Up package (while this is not a breaking change per se, it can be in some edge situations).
- The plugin now has a _peer dependency_ on `rollup ^2.60.0 || ^3.0.0`.

#### Breaking changes in version 4
- In previous versions, the `deps` option defaulted to `false`.<br>This was practical, but often wrong: when bundling for distribution, you want your own dependencies to be installed by the package manager alongside your package, so they should not be bundled in the code. Therefore, the `deps` option now defaults to `true`.
- Now requires Node 14 (up from Node 12 for previous versions).
- Now has a _peer dependency_ on `rollup ^2.60.0`.

</details>


## License
MIT
