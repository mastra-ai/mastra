---
'@mastra/docker': minor
---

Build one Docker repo template from several repositories. `createDockerRepoTemplate` accepts `repos` (each entry with its own `getRepositoryAccess`, `ref` and `setupCommand`), `workspaceSetupCommand` and `continueOnSetupFailure`. Every repository is cloned under the working directory, public ones first, with its own setup marker; a failing setup can be recorded in `.mastra-sandbox/setup-failed` instead of failing the build. In both forms the commit pin now follows the first setup pass so the clone and install layers cache across commits (credentials are build secrets, so this holds for private repositories too); images built with an earlier version rebuild once, and setup commands must be safe to run twice in the same checkout.
