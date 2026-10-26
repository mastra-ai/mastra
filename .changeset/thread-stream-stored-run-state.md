---
'@mastra/core': patch
---

Fixed agent thread streams that misreported a run's state when pubsub events were missing. A run parked on approval no longer fails with `AgentThreadLeaseLostError` after its lease lapses, even if this subscriber never saw the approval prompt. A replayed `run-suspended` event for a run that has since finished no longer leaves the thread stuck as active. In both cases the runtime now reads the run's stored status before it decides.
