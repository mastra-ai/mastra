---
'@mastra/code-sdk': patch
---

Fixed the Anthropic subscription error shown when a saved sign-in can no longer be renewed. It now says "Failed to refresh the Anthropic token." instead of "Not logged in to Anthropic.", matching the other subscription providers.
