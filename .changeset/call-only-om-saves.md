---
'@mastra/memory': patch
---

Fixed agent turns being lost when `observationalMemory` is enabled only in a call's `memory.options` and not on the `Memory` instance. Observational memory runs only when it is configured on the instance, so a call-only opt-in now falls back to normal message history instead of skipping the save, and Memory logs a one-time warning that the opt-in was ignored. Per-call opt-outs are unchanged. Before, the regular agent saved nothing for the turn and durable agents saved only the user message.
