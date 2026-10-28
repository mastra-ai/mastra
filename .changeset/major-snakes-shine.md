---
'@mastra/inngest': minor
---

Added native outcomes and typed stop-reason context to workflow roots, steps, and control-flow spans through existing durable span operations. Nested guardrails retain their cause, and completed suspension and resume segments retain separate outcomes. This does not add storage checkpoints or worker-replacement recovery.
