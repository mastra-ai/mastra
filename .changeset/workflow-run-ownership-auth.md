---
'@mastra/server': patch
---

Tightened ownership checks on workflow run routes when `server.auth.mapUserToResourceId` is configured. A caller mapped to a resource can only act on its own runs, including when it passes an existing run id to `/stream`, `/create-run`, `/start-async` or `/stream-legacy`, and when it resumes, recovers or approves a durable agent run. The worker endpoints `steps/execute` and `/workflows/events` apply the same check to the run they address. Restarting all active runs of a workflow now requires a privileged caller. A caller without a resource id is treated as privileged only when a fine-grained authorization (FGA) provider is configured to authorize the route.

**Before:** with `mapUserToResourceId` configured, a caller with no mapped resource id could read and act on any run, and a mapped caller could act on runs saved without a resource id.

**After:** a mapped caller acts only on its own runs. Admin, service, worker and push-broker callers that are not mapped to a resource need an FGA provider for run access, and restarting all active runs requires such a privileged caller. Runs saved without a resource id are no longer reachable by mapped callers.

To keep privileged run access, configure an FGA provider next to the mapper:

```ts
export const mastra = new Mastra({
  server: {
    auth: {
      authenticateToken: async token => verifyAccessToken(token),
      mapUserToResourceId: user => `${user.workspaceId}:${user.id}`,
    },
    fga: fgaProvider,
  },
});
```

**Servers without `mapUserToResourceId`** keep the previous rule: deny only when the caller's resource id and the run's resource id are both present and differ. That rule now also runs on routes that had no ownership check: `/stream`, `/create-run`, `/start-async`, `/stream-legacy`, `steps/execute`, `/workflows/events`, and the durable agent resume and recover routes. Reusing another resource's run id on those routes used to succeed and now returns 403.
