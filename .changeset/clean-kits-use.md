---
'@mastra/deployer': patch
---

Fixed bundling of workspace packages in monorepo setups.

**What was fixed:**

- Bundles now correctly include workspace packages with hyphenated names
- Workspace TypeScript sources compile correctly when resolved through workspace symlinks
- Transitive workspace dependencies are included when the entry point is generated

**Why this happened:**

Earlier workspace resolution logic skipped some workspace paths and virtual entries, so those dependencies were missed.
