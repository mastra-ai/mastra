---
'@mastra/core': patch
---

Boot-time workflow recovery no longer re-runs a workflow run that another live server instance is still executing. Previously, when one replica started while another was mid-run, `restartAllActiveWorkflowRuns()` restarted every `running` run and its steps executed twice.

Workflow runs now hold the existing storage run-ownership lease (the one durable agents use) while they execute. `run.restart()` throws a `WORKFLOW_RESTART_RUN_OWNED` error instead of taking over a live run. The boot sweep skips those runs and checks them again once the lease could have expired, so runs left behind by a crashed process are still recovered. Storage adapters without run-ownership support keep the previous behavior.
