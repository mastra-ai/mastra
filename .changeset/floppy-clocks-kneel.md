---
'mastracode': patch
---

Model pack fallback notices now name the cause first, for example `Anthropic is out of credits or quota, switched to OpenAI`.

A request the provider rejects, such as a prompt too long for the first model, now moves to the next model in the pack, with a notice. Before, the run stopped with `Processor "mastracode-account-rotation" stopped the run: …`.
