---
'@mastra/core': patch
---

fix(core): merge non-user signal data parts onto previous assistant message when loading from memory

Non-user signals (system-reminder, reactive, notification, etc.) stored as separate role:'signal' DB messages were being converted to role:'system' UI messages with data-* parts. assistant-ui rejects system messages with non-text parts, causing a render crash ("System messages must have exactly one text message part").

Now, after per-message adapter conversion, a batch post-processing step merges non-user signal data parts onto the preceding assistant message and removes the standalone signal message. This matches the behavior during active streaming where signals are written as data parts on the current assistant message. User-type signals (type: 'user' or 'user-message') remain as standalone role:'user' messages.
