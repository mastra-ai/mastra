---
'@mastra/deployer': patch
---

fix(deployer): deduplicate Rollup instances in analyzeEntry to prevent hang in large monorepos

Adds a shared `analyzeCache` map that prevents re-analyzing the same entry file across recursive `analyzeEntry` calls during transitive workspace dependency resolution. In large monorepos where multiple workspace packages share dependencies, this avoids spawning redundant Rollup instances that cause `mastra dev` to hang.
