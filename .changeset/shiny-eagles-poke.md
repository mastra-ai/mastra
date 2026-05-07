---
'mastracode': patch
---

Fixed OpenAI Codex login when the default callback port is already in use. The login flow now falls back to the Codex-supported fallback port and shows a clear warning when both supported callback ports are unavailable.
