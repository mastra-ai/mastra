---
'@mastra/core': patch
---

Fixed a claimed thread owner running an idle wake twice when a sender retried the same cross-agent message after its acceptance acknowledgement was lost. Such a retry now resolves to the outcome the first attempt already accepted — its run, or the reason it failed or was cancelled before it ran — instead of starting a second turn that repeats the turn's tool side effects.