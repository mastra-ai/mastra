---
'mastracode': patch
---

Persisted thinking level is now treated as a global preference. `/think`, Settings, and OpenAI-driven model pack updates now save the selected level to `settings.json` so it survives restarts and new threads. Also tightened typing around thinking-level persistence to avoid unsafe casts when writing preferences.
