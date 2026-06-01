---
'@mastra/core': patch
---

Fixed a render crash when loading stored threads containing signal messages (such as system reminders). Non-user signal data parts are now merged onto the neighboring assistant message instead of becoming standalone system messages that break assistant-ui.
