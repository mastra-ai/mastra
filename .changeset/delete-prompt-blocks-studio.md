---
'mastra': patch
---

Added a Delete button to the prompt block editor in Studio so you can remove stored prompt blocks directly from the UI. Previously the delete endpoint existed but no UI consumed it, forcing a manual API call. A confirmation dialog guards against accidental deletion, and you are returned to the prompt blocks list once a block is deleted. Fixes #22356.
