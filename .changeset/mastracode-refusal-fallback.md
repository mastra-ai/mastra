---
'@mastra/code-sdk': minor
'mastracode': minor
---

When a model refuses a request on cybersecurity grounds and a `continue` retry doesn't help, Mastra Code now finishes that turn on another pack instead of ending it. By default it uses the next pack in the active pack's fallback chain. Choose **Set cyber refusal fallback…** in `/models` to send refusals to a different pack. The transcript shows "Switched model pack: … (model refused)", and your next message goes back to the active pack. Packs with neither setting behave as before.
