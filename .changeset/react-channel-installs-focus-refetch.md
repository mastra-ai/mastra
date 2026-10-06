---
'@mastra/react': minor
---

Added a `useReconcileChannelInstallation` hook that asks the server to check a pending channel installation against the platform and activate it if its connect flow has finished out-of-band (for example Discord's bot invite, which never redirects back). On success it refreshes the installations query, so the UI flips to "Connected" without a manual refresh.

```ts
const { mutate: reconcile } = useReconcileChannelInstallation({ platform: 'discord' });
// e.g. on window focus while a connect is in flight:
reconcile(agentId);
```

Reconciliation is a deliberate write, so `useChannelInstallations` no longer refetches on every window focus — call the new hook from the surface that knows a connect is in flight instead.
