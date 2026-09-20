---
'@mastra/memory': minor
---

Added native `model: 'auto'` support for Observational Memory. Observer and Reflector models now resolve independently from the active agent model while preserving explicit model IDs and advanced model configurations.

`'auto'` is also the **new default** for `model`, `observation.model`, and `reflection.model`, which previously defaulted to `google/gemini-2.5-flash`. Observational Memory without an explicit model therefore no longer runs on Gemini: it prefers Gemini when `GOOGLE_GENERATIVE_AI_API_KEY` is configured, then the low-cost model for the actor model's provider, then the actor model itself. Set a concrete model ID to keep a fixed model, and note that auto can fail where the old pinned default worked if the active provider has no reachable credential and no low-cost entry.
