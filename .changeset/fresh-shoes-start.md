---
'mastracode': minor
---

Added signal-based follow-up support for Mastra Code.

Text submitted while an agent run is active now continues the current thread, shows as pending until the signal echo confirms it, and avoids duplicate stream rendering by following thread output through one subscription owner.
