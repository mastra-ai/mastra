---
'mastracode': patch
---

Fixed OpenAI Codex OAuth model routing for observational memory.

When Codex OAuth is active, observer and reflector model IDs now remap GPT-5 OpenAI models to Codex-compatible variants before provider resolution. This prevents observational memory runs from failing when a non-codex GPT-5 model ID is selected.

Also enforced a minimum reasoning level of `low` for GPT-5 Codex requests so `off` is not sent to Codex for those models.
