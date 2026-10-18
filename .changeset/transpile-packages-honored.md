---
'@mastra/deployer': patch
'mastra': patch
---

Fixed `bundler.transpilePackages` being silently ignored by `mastra build` and `mastra dev`. Packages listed there that ship TypeScript source from `node_modules` are now transpiled and bundled, including when `externals: true` is set and during `mastra dev`. Previously only workspace packages were transpiled, so a non-workspace TypeScript package failed with a parse error.

```ts
export const mastra = new Mastra({
  bundler: {
    transpilePackages: ['@my-org/shared-utils'],
  },
});
```
