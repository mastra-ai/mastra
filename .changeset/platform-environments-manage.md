---
'@mastra/platform': minor
---

Added environment management to `MastraPlatform` and `MastraProject`. `project.environments` now gets, updates, deletes and restores environments, sets and removes some of their variables without touching the rest, restarts the deployed server, and reads deploys and their logs.

```ts
await project.environments.setVars(environmentId, { LOG_LEVEL: 'debug' });
await project.environments.restart(environmentId);

const [latest] = await project.environments.listDeploys(environmentId);
console.log(latest.status, await project.environments.deployLogs(environmentId, latest.id));
```
