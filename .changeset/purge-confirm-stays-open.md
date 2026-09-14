---
'mastra': patch
---

Keep the "Purge Data" confirmation open while the purge request is in flight. Previously the dialog dismissed itself as soon as the confirm button was clicked, hiding the pending state and any failure behind a toast.
