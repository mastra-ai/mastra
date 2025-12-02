# vite-plugin-lib-inject-css

[![npm version](https://img.shields.io/npm/v/vite-plugin-lib-inject-css)](https://npmjs.com/package/vite-plugin-lib-inject-css)
![weekly downloads](https://img.shields.io/npm/dw/vite-plugin-lib-inject-css)
![license](https://img.shields.io/npm/l/vite-plugin-lib-inject-css)
![stars](https://img.shields.io/github/stars/emosheeep/vite-plugin-lib-inject-css)

English | [简体中文](https://juejin.cn/post/7214374960192782373)

Inject css at the top of each chunk file in library mode using `import` statement, support multi-entries build, especially to help building component libraries.

```js
// bundled js file, with import css at top (if any)
import './style.css';
// rest of the file
// ...
```

> **Can css be styleInjected in library mode**? [vite#1579](https://github.com/vitejs/vite/issues/1579).

# Features

Note that this plugin only works with [library-mode](https://vitejs.dev/guide/build.html#library-mode).

- 💡 Multiple entires support.
- ⚡️ Sourcemap support.
- 💻 SSR build support.
- 🛠 Out-of-box, tiny and pretty.

# Quick Experience

View the [cloud ide](https://stackblitz.com/~/github.com/emosheeep/vite-plugin-lib-inject-css) on stackblitz.com, and setup with the following scripts:

```sh
pnpm install
cd example
pnpm build
```

# Usage

```shell
pnpm i vite-plugin-lib-inject-css -D # npm/yarn
```

```js
// vite.config.ts
import { libInjectCss } from 'vite-plugin-lib-inject-css';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    libInjectCss(),
  ],
  build: {
    lib: {
      formats: ['es'],
      entry: {
        index: 'src/index.ts',
        button: 'src/components/button/index.ts',
        select: 'src/components/select/index.ts',
      },
    }
    rollupOptions: {
      output: {
        // Put chunk files at <output>/chunks
        chunkFileNames: 'chunks/[name].[hash].js',
        // Put chunk styles at <output>/assets
        assetFileNames: 'assets/[name][extname]',
        entryFileNames: '[name].js',
      },
    },
  }
})
```

# Motivation

Vite shines in Web project development, but it can also be used for library projects.

But when it comes to component library development, multiple entries are often involved. Although `Vite 3.2+` later supports multiple entry points, it doesn't provide relevant options for us to associate css with component, which leads to the problem that we can't distinguish between the entry point and css files even though the bundle is successful.

Based on this, we need to write a plugin to try to find the relationship between the two, and inject styles correctly.

# How does It Work

As a library(mostly component library), we want to import styles automatically when referencing the component.

```js
/** component-lib/dist/button.js */
import './assets/button.css'; // This is what this plugin do;
...
export default Button;

/** component-lib/dist/index.js */
import Button from './button.js';
import xxx from './xxx.js';
export { Button, xxx };
...

/** In our project's main file */
// Once we import Button, styles'll be imported together.
import { Button } from 'component-lib';
```

The simplest way is to add a line `import './style.css';` to the top of the generated file, multiple lines are multiple lines. As a library provider, we should **provide flexibility as much as possible**, and **delegate the task of how to handle these css files to the user's build tool**.

But most of the Vite plugins on the market that claim to automatically inject CSS are designed in a way use `document.createElement ('style')`, which is not graceful, and **it assumes that the current is in the Browser's DOM environment, which makes the library SSR-incompatible**.

Here's the reply([vite#issuecomment](https://github.com/vitejs/vite/issues/1579#issuecomment-763295757)) of the author of Vite, Evan You.

So the main problem becomes to **how do we know which style files are involved in one chunk file**?

In fact, vite adds a property named `viteMetadata` on each chunk file in plugin lifecycle, you can check [css.ts](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/css.ts) for further information.

We can get which resources(include CSS files) are associated with current chunk file by using this property. Based on this, the plugin injects styles by using [renderChunk](https://rollupjs.org/plugin-development/#renderchunk) hook, which is the simplest and most effective way.

*Prefer to check plugin source code to get more information and welcome to make contribution*, which is simple enough(100+ lines).

# Recipes of Creating Component Library

How do we create a component library with vite, which can auto import styles and has out-of-box tree-shaking functionality?

Most of component libraries provide two ways. One is totally import:

```js
import Vue from 'vue';
import XxxUI from 'component-lib';
Vue.use(XxxUI);
```

The other is import on demand, in common uses with a third-part plugin like `babel-plugin-import`:

```js
import { Button } from 'component-lib';
// ↓ ↓ ↓ transformed ↓ ↓ ↓
import Button from 'component-lib/dist/button/index.js'
import 'component-lib/dist/button/style.css'
```

**But the best way is that when we use named imports, the style imports and tree-shaking can be applied automatically**.

## How Should We do

Fortunately, ES Module naturally has static analysis capabilities, and mainstream tools basically implement ESM-based Tree-shaking functions, such as `webpack/rollup/vite`.

Then we only need the following three steps:
1. Adjust the output format to ES Module → Out-of-the-box Tree-shaking functionality.
2. Use this plugin for style injection → auto import styles
3. The last and most important, **add all of the entry files you’ve exported in main.js to your `rollup.input` configurations**.

It should be noted that the import of CSS files has side effects, and we also need to **declare the [sideEffects](https://webpack.js.org/guides/tree-shaking) field in the library's package.json file** to prevent the CSS file from being accidentally removed by the user side builds.

Here's an example:

```json
{
  "name": "component-lib",
  "version": "1.0.0",
  "main": "dist/index.mjs",
  "sideEffects": [
    "**/*.css"
  ]
}
```

# Questions

## Why does Style Code Injection Fail?

Here're some possible reasons:

- When `build.cssCodeSplit` is `false`, all of css code will be collected into a standalone css file named `style.css`, **style injection will be skipped**.

- *Before v2.2.0*, when `rollupOptions.output.preserveModules` is enabled, the style code injection will be skipped for some reasons. This problem has been solved, refers to [#29](https://github.com/emosheeep/vite-plugin-lib-inject-css/issues/29).

```js
{
  build: {
    cssCodeSplit: true, // Required. This is set internally by default.
  },
  rollupOptions: {
    output: {
      preserveModules: false, // Required before v2.2.0.
    }
  }
}
```

## About Rollup Option `output.preserveModules`

Anytime when you attempt using this option, there in common may  has more efficient ways to help you. For example, **you can turn every file into an entry point, like suggested in the Rollup [docs](https://rollupjs.org/configuration-options/#input)**:

> If you want to convert a set of files to another format while maintaining the file structure and export signatures, the recommended way—instead of using `output.preserveModules` that may tree-shake exports as well as emit virtual files created by plugins—is to turn every file into an entry point. You can do so dynamically e.g. via the `glob` package:

## Why do Additional Empty Imports Turn Up in Entry Chunks?

When using **multiple** chunks, imports of dependencies of entry chunks will be added as empty imports to the entry chunks themselves. This is rollup's default behavior **in order for javascript engine performance optimizations**, you can turn it off via `output.hoistTransitiveImports: false`.

Here's an example:

```js
// dist/demo.js
import { _ as p } from "../chunks/demo.js";
import "vue";
import "axios";
import "lodash-es";
import "xxx"; // ... and so on.
export {
  p as Demo
};
```

Further, see [why-do-additional-imports-turn-up-in-my-entry-chunks-when-code-splitting](https://rollupjs.org/faqs/#why-do-additional-imports-turn-up-in-my-entry-chunks-when-code-splitting).

As a third-part library, this behavior may cause sideEffects and make tree-shaking fail, so we set `hoistTransitiveImports: false` internally by default, you can still manually overwrite it.

## Output Directory Structure is Ugly when Building with Multi-entries.

When we build our library with multi-entries, the output looks as follows in common:

```
dist/demo.css            0.05 kB │ gzip: 0.07 kB
dist/demo-451ab1e5.mjs   0.36 kB │ gzip: 0.26 kB
dist/demo-component.mjs  0.09 kB │ gzip: 0.10 kB
dist/index.mjs           0.16 kB │ gzip: 0.14 kB
```

Generally speaking, **the users who use your library usually don't care about how does your dist directory structure looks like**. Just don’t tangle this, we just need to ensure that the unused files will get tree-shaken when we use named imports from the library.

Indeed, you can customize filenames by using `output.xxxFileNames` options:

```js
{
  rollupOptions: {
    output: {
      // Put chunk files at <output>/chunks
      chunkFileNames: 'chunks/[name].[hash].js',
      // Put chunk styles at <output>/assets
      assetFileNames: 'assets/[name][extname]',
      entryFileNames: '[name].js',
    },
  },
}
```

And then you'll get:

```
dist/assets/demo.css          0.05 kB │ gzip: 0.07 kB
dist/chunks/demo.a6107609.js  0.37 kB │ gzip: 0.26 kB
dist/demo-component.js        0.09 kB │ gzip: 0.10 kB
dist/index.js                 0.15 kB │ gzip: 0.14 kB
```

# License

[MIT](./LICENSE) License © 2023 [秦旭洋](https://github.com/emosheeep)
