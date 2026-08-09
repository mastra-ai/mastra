---
'@mastra/deployer': patch
'@mastra/core': patch
---

Add `bundler.minify` to minify `mastra build` output

`mastra build` always emitted unminified code, which is larger than necessary when packaging for production — a container image or an on-prem deployment.

Set `bundler.minify: true` to minify the emitted bundle. Minification runs over whole chunks, so comments and whitespace are dropped and local identifiers are shortened while exported names are preserved.

```typescript
export const mastra = new Mastra({
  bundler: {
    minify: true,
  },
});
```

Defaults to `false`, so existing builds are unchanged. `mastra dev` is never minified.
