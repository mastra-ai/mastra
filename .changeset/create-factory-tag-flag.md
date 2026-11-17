---
'create-factory': minor
---

Added a `--tag <dist-tag>` option to `create-factory`. It pins the scaffolded template's `mastra` and `@mastra/*` dependencies to the exact versions published under that npm dist-tag, so you can try a new Factory on prerelease packages:

```sh
npx create-factory@latest my-factory --tag alpha
```

When the pinned versions include prereleases and the project uses npm, `create-factory` also writes `legacy-peer-deps=true` to the project's `.npmrc`, because npm otherwise rejects the prerelease peer ranges.
