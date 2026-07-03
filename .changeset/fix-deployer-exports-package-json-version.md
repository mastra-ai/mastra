---
'@mastra/deployer': patch
---

Fixed `mastra build` pinning the wrong version of an external dependency when the installed package's `exports` map does not expose `./package.json` (for example, `execa@9`).

The deployer resolved each external dependency's version by reading `<pkg>/package.json` through Node module resolution. For a package whose `exports` map omits `./package.json`, that lookup fails for the correct copy and silently falls back to an older copy hoisted elsewhere in the workspace — so `.mastra/output/package.json` recorded the wrong version and the deployed server could crash on an incompatible API. The deployer now resolves each dependency's directory from its main entry point instead, so the recorded version matches the copy the bundled code actually uses. Closes #18849.
