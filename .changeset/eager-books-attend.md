---
'@mastra/core': patch
---

Fixed `Run.cancel()` so it interrupts an in-flight `.sleep()` / `.sleepUntil()` immediately instead of waiting for the full duration and overwriting the canceled status. (#17908)

Previously, canceling during a long sleep left the timer running, then woke the run back to `running` and recorded the sleep step as `success` before settling as canceled again. Downstream steps after the sleep could still run. Cancel now clears the wait right away, keeps the run `canceled`, and does not continue past the sleep.
