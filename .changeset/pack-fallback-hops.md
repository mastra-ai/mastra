---
'@mastra/code-sdk': patch
'mastracode': patch
---

Add fallback model packs: `settings.models.packFallbacks` (pack → pack, chains allowed, cycles capped at one revisit per cascade) editable from `/models` via "Set fallback pack…". When every account serving the active pack's provider is unavailable, the turn hops to the fallback pack's model for the current mode, renders a persisted notice in the transcript, and the thread stays on the landed pack until you switch back manually.
