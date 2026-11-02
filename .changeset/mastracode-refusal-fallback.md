---
'@mastra/code-sdk': minor
'mastracode': minor
---

When a model refuses a request on cybersecurity grounds and a `continue` retry doesn't help, Mastra Code now finishes that turn on another model instead of ending it. By default it first switches to the model the provider itself routes cyber refusals to (Claude Fable 5, Fable 5.1 and Opus 5.5 → Opus 4.8, Sonnet 5.5 → Sonnet 5, GPT-5.3-Codex → GPT-5.2), then to the next pack in the active pack's fallback chain. Choose **Set cyber refusal fallback…** in `/models` to send refusals to a different pack. The transcript shows "Switched model pack: … (model refused)", and your next message goes back to the active pack. Other models on packs with no fallback behave as before.
