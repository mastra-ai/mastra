---
'@internal/playground': patch
---

Fixed Studio chat leaving a stale "pending" signal indicator above the message input. Sending a follow-up message while the agent was idle could leave one or more shimmering "pending: …" badges that lingered after the reply finished (and piled up across messages), only disappearing on a page refresh. The badge now clears reliably regardless of whether the send confirmation or its echo arrives first.
