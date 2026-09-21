---
'@mastra/deployer': minor
---

Extended pnpm patch preservation to yarn (Berry) and bun, so `mastra build` keeps patches applied in the bundled output regardless of package manager.

Yarn needs no configuration: `.yarn/patches/` is copied into the output and Yarn applies the patches its lockfile already references.

Bun declares patches in `package.json`, and `mastra build` rewrites them to output-relative paths in the bundled `package.json`:

```json
{
  "patchedDependencies": {
    "lodash@4.17.21": "patches/lodash.patch"
  }
}
```
