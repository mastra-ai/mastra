---
'@mastra/core': minor
'mastra': minor
---

`mastra build` now deploys in one step for push-style deployers. Deployers can opt in with the new `deployOnBuild` flag on the deployer contract, and the build runs their `deploy()` right after bundling. `SandboxDeployer` from `@mastra/deployer-sandbox` opts in, so configuring it means `mastra build` bundles your project, deploys it into the sandbox, and prints the live URL. Existing platform deployers are unchanged.
