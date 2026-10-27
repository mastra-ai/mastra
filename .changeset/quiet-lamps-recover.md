---
'@mastra/core': patch
---

Fixed `DurableAgent.recover()` reporting an initial pending snapshot without workflow input as corrupt. It now throws `DURABLE_AGENT_RECOVER_CHECKPOINT_NOT_AVAILABLE` with guidance to enable running-checkpoint persistence before starting the run, while preserving malformed-snapshot and ownership checks.
