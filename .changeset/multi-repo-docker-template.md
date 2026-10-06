---
'@mastra/docker': minor
---

Build one Docker repo template from several repositories. `createDockerRepoTemplate` accepts `repos` (each entry with its own `getRepositoryAccess`, `ref` and `setupCommand`), `workspaceSetupCommand` and `continueOnSetupFailure`. Every repository is cloned under the working directory, public ones first, with its own setup marker; a failing setup can be recorded in `.mastra-sandbox/setup-failed` instead of failing the build.
