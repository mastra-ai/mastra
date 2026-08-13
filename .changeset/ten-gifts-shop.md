---
'@mastra/factory': minor
---

Added independent GitHub issue and pull request reconciliation controls for Factory, with legacy reconciliation settings preserved as fallbacks. Added Linear issue reconciliation aliases and automatically move linked work cards to Done or Canceled when upstream issues close.

For example, run GitHub issue reconciliation every minute while leaving pull-request reconciliation at its existing cadence:

```sh
MASTRACODE_GITHUB_ISSUE_RECONCILE_INTERVAL_MS=60000
```
