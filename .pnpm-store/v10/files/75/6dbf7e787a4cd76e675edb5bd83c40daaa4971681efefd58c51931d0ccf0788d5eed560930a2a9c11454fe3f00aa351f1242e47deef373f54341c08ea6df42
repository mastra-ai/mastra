# esm-loader

[Node.js loader](https://nodejs.org/api/esm.html#loaders) for loading TypeScript files.

### Features
- Transforms TypeScript to ESM on demand
- Classic Node.js resolution (extensionless & directory imports)
- Cached for performance boost
- Supports Node.js v12.20.0+
- Handles `node:` import prefixes
- Resolves `tsconfig.json` [`paths`](https://www.typescriptlang.org/tsconfig#paths)
- Named imports from JSON modules

> **Protip: use with _cjs-loader_ or _tsx_**
>
> _esm-loader_ only transforms ES modules (`.mjs`/`.mts` extensions or `.js` files in `module` type packages).
>
> To transform CommonJS files (`.cjs`/`.cts` extensions or `.js` files in `commonjs` type packages), use this with [_cjs-loader_](https://github.com/esbuild-kit/cjs-loader).
>
> Alternatively, use [tsx](https://github.com/esbuild-kit/tsx) to handle them both automatically.

<br>

<p align="center">
	<a href="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=platinum">
		<picture>
			<source width="830" media="(prefers-color-scheme: dark)" srcset="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=platinum&image=dark">
			<source width="830" media="(prefers-color-scheme: light)" srcset="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=platinum&image">
			<img width="830" src="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=platinum&image" alt="Premium sponsor banner">
		</picture>
	</a>
</p>

## Install

```sh
npm install --save-dev @esbuild-kit/esm-loader
```

## Usage

Pass `@esbuild-kit/esm-loader` into the [`--loader`](https://nodejs.org/api/cli.html#--experimental-loadermodule) flag.
```sh
node --loader @esbuild-kit/esm-loader ./file.ts
```

### TypeScript configuration
The following properties are used from `tsconfig.json` in the working directory:
- [`strict`](https://www.typescriptlang.org/tsconfig#strict): Whether to transform to strict mode
- [`jsx`](https://esbuild.github.io/api/#jsx): Whether to transform JSX
	> **Warning:** When set to `preserve`, the JSX syntax will remain untransformed. To prevent Node.js from throwing a syntax error, chain another Node.js loader that can transform JSX to JS.
- [`jsxFactory`](https://esbuild.github.io/api/#jsx-factory): How to transform JSX
- [`jsxFragmentFactory`](https://esbuild.github.io/api/#jsx-fragment): How to transform JSX Fragments
- [`jsxImportSource`](https://www.typescriptlang.org/tsconfig#jsxImportSource): Where to import JSX functions from
- [`allowJs`](https://www.typescriptlang.org/tsconfig#allowJs): Whether to apply the tsconfig to JS files
- [`paths`](https://www.typescriptlang.org/tsconfig#paths): For resolving aliases

#### Custom `tsconfig.json` path
By default, `tsconfig.json` will be detected from the current working directory.

To set a custom path, use the `ESBK_TSCONFIG_PATH` environment variable:

```sh
ESBK_TSCONFIG_PATH=./path/to/tsconfig.custom.json node --loader @esbuild-kit/esm-loader ./file.ts
```

### Cache
Modules transformations are cached in the system cache directory ([`TMPDIR`](https://en.wikipedia.org/wiki/TMPDIR)). Transforms are cached by content hash so duplicate dependencies are not re-transformed.

Set environment variable `ESBK_DISABLE_CACHE` to a truthy value to disable the cache:

```sh
ESBK_DISABLE_CACHE=1 node --loader @esbuild-kit/esm-loader ./file.ts
```

<br>

<p align="center">
	<a href="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=gold">
		<picture>
			<source width="830" media="(prefers-color-scheme: dark)" srcset="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=gold&image=dark">
			<source width="830" media="(prefers-color-scheme: light)" srcset="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=gold&image">
			<img width="830" src="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=gold&image" alt="Premium sponsor banner">
		</picture>
	</a>
</p>

## FAQ

### Can it import JSON modules?
Yes. This loader transpiles JSON modules so it's also compatible with named imports.

### Can it import ESM modules over network?

Node.js has built-in support for network imports [behind the `--experimental-network-imports` flag](https://nodejs.org/api/esm.html#network-based-loading-is-not-enabled-by-default).

You can pass it in with `esm-loader`:

```sh
node --loader @esbuild-kit/esm-loader --experimental-network-imports ./file.ts
```

### Can it resolve files without an extension?

In ESM, import paths must be explicit (must include file name and extension).

For backwards compatibility, this loader adds support for classic Node resolution for extensions: `.js`, `.json`, `.ts`, `.tsx`, `.jsx`. Resolving a `index` file by the directory name works too.

```js
import file from './file' // -> ./file.js
import directory from './directory' // -> ./directory/index.js
```

### Can it use Node.js's CommonJS resolution algorithm?

ESM import resolution expects explicit import paths, whereas CommonJS resolution expects implicit imports (eg. extensionless & directory imports).

As a result of this change, Node.js changes how it imports a path that matches both a file and directory. In ESM, the directory would be imported, but in CJS, the file would be imported.

To use to the CommonJS resolution algorithm, use the [`--experimental-specifier-resolution=node`](https://nodejs.org/api/cli.html#--experimental-specifier-resolutionmode) flag.

```sh
node --loader @esbuild-kit/esm-loader --experimental-specifier-resolution=node ./file.ts
```

## Related

- [tsx](https://github.com/esbuild-kit/tsx) - Node.js runtime powered by esbuild using [`@esbuild-kit/cjs-loader`](https://github.com/esbuild-kit/cjs-loader) and [`@esbuild-kit/esm-loader`](https://github.com/esbuild-kit/esm-loader).

- [@esbuild-kit/cjs-loader](https://github.com/esbuild-kit/cjs-loader) - TypeScript & ESM to CJS transpiler using the Node.js loader API.

## Sponsors

<p align="center">
	<a href="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=silver1">
		<picture>
			<source width="410" media="(prefers-color-scheme: dark)" srcset="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=silver1&image=dark">
			<source width="410" media="(prefers-color-scheme: light)" srcset="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=silver1&image">
			<img width="410" src="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=silver1&image" alt="Premium sponsor banner">
		</picture>
	</a>
	<a href="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=silver2">
		<picture>
			<source width="410" media="(prefers-color-scheme: dark)" srcset="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=silver2&image=dark">
			<source width="410" media="(prefers-color-scheme: light)" srcset="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=silver2&image">
			<img width="410" src="https://privatenumber-sponsors.vercel.app/api/sponsor?tier=silver2&image" alt="Premium sponsor banner">
		</picture>
	</a>
</p>

<p align="center">
	<a href="https://github.com/sponsors/privatenumber">
		<img src="https://cdn.jsdelivr.net/gh/privatenumber/sponsors/sponsorkit/sponsors.svg">
	</a>
</p>
