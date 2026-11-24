---
'mastracode': patch
---

Model pack fallback notices now name the cause first, and how long the provider asks to wait when it says, for example `Anthropic is rate-limited for 5 min, switched to OpenAI`.

After a rate limit, the thread now goes back to the failed model pack with your first message after the provider's retry time. The status line shows when: `Using fallback OpenAI until 14:05 (Anthropic failed)`. Before, the thread stayed on the fallback pack until you ran `/models`, which is still the case when the provider sends no retry time.

An error that does not switch model packs, such as a prompt that is too long, now shows the provider's own error instead of `Processor "mastracode-account-rotation" stopped the run: …`.
