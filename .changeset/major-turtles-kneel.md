---
'mastra': patch
---

Added best-effort local saving for Studio composer drafts, including text, local files, and URL attachments. Drafts are scoped to the server, user, agent, and conversation and restored when returning. Saves are debounced while typing; very recent edits may be lost on an immediate reload. Sending clears only the submitted content, preserving newer edits.

Studio shows a warning if local saving fails. Signing out attempts to clear the current user's drafts without delaying logout. Browser storage retains up to 20 drafts for seven days, limited to 50,000 text characters, 20 attachments, and 10 MB per draft, with 50 MB total. Edits across tabs use the last saved version. File-format support and failed-send recovery are unchanged.
