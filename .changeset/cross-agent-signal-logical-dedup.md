---
'@mastra/core': patch
---

Fixed a claimed thread owner running an idle wake twice when a sender retried the same cross-agent message after its acceptance acknowledgement was lost. Idle signals are now deduplicated by the sender's logical message identity — target agent, thread, source peer id, and message id — in addition to the transport request id, so a retry resolves to the run the first attempt already accepted, or to the terminal reason if that attempt failed or was cancelled before it ran, instead of starting a second turn that repeats the turn's tool side effects.
