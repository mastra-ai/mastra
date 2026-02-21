---
'mastracode': patch
---

Fixed Ctrl+F follow-up queueing to resolve autocomplete suggestions before reading editor text, so partially typed slash commands (e.g. /rev) are expanded to their full form (e.g. /review). Slash commands queued via Ctrl+F are now properly processed through the slash command handler after the agent finishes, instead of being sent as raw text to the LLM.
