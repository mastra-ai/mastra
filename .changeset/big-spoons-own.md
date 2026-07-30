---
'@mastra/factory': patch
---

Self-hosted GitHub deployments now detect merged pull requests.

Merge state previously reached the factory only through GitHub webhooks. A deployment GitHub cannot reach — local development, or any server behind a private network — never received one, so its pull request cards stayed `open` forever and merge rules never fired.

A background sweep now reads live pull request state for the cards that are still open and replays missed merges through the normal rules ingress, which dedupes them against the webhook path. Webhooks remain the fast path; this is the safety net that was already running on platform-backed deployments.

The sweep runs every 5 minutes, is scoped to repositories linked to a factory project, and coordinates across replicas so only one sweeps at a time.

It also retires the thread's pull request subscription, which the webhook handler was previously the only thing to do. That is what the PR chip in a thread and the workspace sidebar row read, so on both self-hosted and platform deployments they now show merged or closed instead of staying open indefinitely.

**Configuration**

```bash
MASTRACODE_GITHUB_RECONCILE_ENABLED=false   # opt out entirely
MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS=60000  # change the cadence
```
