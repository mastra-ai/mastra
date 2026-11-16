---
'create-factory': minor
---

Added `--alpha` and `--latest` flags to `create-factory`. They pin the scaffolded template's `mastra` and `@mastra/*` dependencies to the exact versions published under that npm tag, so you can try a new Factory on prerelease packages:

```bash
npx create-factory@latest my-factory --alpha
```

With npm, `--alpha` also writes `legacy-peer-deps=true` to the project's `.npmrc`, because npm otherwise rejects the alpha packages' prerelease peer ranges.
