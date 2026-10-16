---
'@mastra/deployer': patch
---

Removed the `find-workspaces` and `gray-matter` dependencies. Monorepo workspace discovery now uses `tinyglobby` and markdown frontmatter is parsed by a helper shared with `@mastra/core`. This removes the vulnerable `braces` (GHSA-vfj7-8cjw-p6xm) and `sprintf-js` (GHSA-hp3w-g68c-fv3c) packages, neither of which has a patched release, from the production dependency tree of `@mastra/deployer`. `npm audit` no longer reports them for this package.
