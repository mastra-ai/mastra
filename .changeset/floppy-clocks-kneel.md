---
'mastracode': patch
---

Model pack fallback notices now name the cause first, for example `Anthropic is out of credits or quota, switched to OpenAI`.

An error that does not switch model packs, such as a prompt that is too long, now shows the provider's own error instead of `Processor "mastracode-account-rotation" stopped the run: …`.
