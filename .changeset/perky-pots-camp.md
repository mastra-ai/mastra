---
'mastracode': patch
---

Fixed the status bar animation not stopping when starting a new conversation with `/new`. The run animation could keep pulsing over an empty conversation when the thread being left was owned by another instance.
