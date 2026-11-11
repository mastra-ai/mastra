---
'mastracode': minor
---

Added Mistral Voxtral as a speech-to-text provider for voice input. Pick `mistral` in `/voice` and set `MISTRAL_API_KEY` (or add a key with `/api-keys`) to dictate with `voxtral-mini-latest`.

Fixed voice input with Groq and the other OpenAI-compatible hosts failing with "No API key provided for speech model" when `OPENAI_API_KEY` was not set.

Fixed voice input with NEAR AI ignoring `NEARAI_API_KEY`. `NEAR_AI_API_KEY` is no longer read; rename it to `NEARAI_API_KEY`.
