---
'mastra': patch
---

Fixed Studio composer drafts being lost when switching threads or reloading, including New Chat. Text, local files, and URL attachments are saved together, scoped to the server, signed-in user, agent, and conversation. Sending preserves newer edits, and conflicting changes from another tab are not overwritten.

Studio warns when drafts cannot be saved and offers confirmed recovery for unreadable saved drafts. Signing out clears the current user's drafts for that server, including drafts open in other tabs. Browser storage keeps up to 20 drafts for seven days, limited to 50,000 text characters, 20 attachments, and 10 MB per draft, with 50 MB total. File-format support and failed-send recovery are unchanged.
