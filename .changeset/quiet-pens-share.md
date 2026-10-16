---
'@internal/core': patch
---

Added a `./frontmatter` export with `parseFrontmatter` and `stringifyFrontmatter`, built on the `yaml` package, so `@mastra/core` and `@mastra/deployer` can share one markdown frontmatter parser without `gray-matter`.
