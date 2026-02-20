---
"@mastra/deployer": patch
"mastra": patch
---

**Fixed** `mastra dev` now runs TypeScript packages listed in `transpilePackages` without a separate build step.

**Why** Dev mode previously tried to execute `.ts` files directly, which caused runtime failures. Fixes #12617.

**Example**

Before:
```ts
// mastra.config.ts
export default { bundler: { transpilePackages: ['@acme/foo'] } };
// mastra dev required a separate build for `@acme/foo`
```

After:
```ts
// mastra.config.ts
export default { bundler: { transpilePackages: ['@acme/foo'] } };
// mastra dev runs without an extra build step
```
