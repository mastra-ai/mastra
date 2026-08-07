---
'@mastra/factory': minor
---

Added automatic GitHub and Linear issue reconciliation so Factory work items stay current when provider metadata changes outside Factory. Platform Linear now tails the Platform event stream and folds a periodic reconcile sweep in on its own cadence, so Issue updates flow into Factory through the normal rules pipeline without waiting for the next board poll.

GitHub issue reconciliation runs inside the same worker as the pull-request reconciler (both self-hosted and Platform), sharing the same lease, cadence, and configured-repository target set. That means one sweep per repository per interval covers both writers of card state.

Reconciliation is on by default. Disable or tune it with environment variables on the Factory server:

```bash
# Turn Linear reconciliation off entirely.
MASTRACODE_LINEAR_RECONCILE_ENABLED=false

# Slow the Linear reconcile sweep down (default: 5 minutes).
MASTRACODE_LINEAR_RECONCILE_INTERVAL_MS=600000

# Stop Platform Linear from tailing the event stream; the reconcile sweep still runs.
MASTRACODE_PLATFORM_LINEAR_POLLING_ENABLED=false

# GitHub reconciliation uses the same shape.
MASTRACODE_GITHUB_RECONCILE_ENABLED=false
MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS=600000
```
