---
'mastra': patch
---

Fixed `create-mastra` appearing to freeze when enabling Mastra platform observability. The auth flow now completes before the template is cloned and dependencies are installed, so the clone/install spinners stay visible instead of being silenced while sign-in ran in the background.
