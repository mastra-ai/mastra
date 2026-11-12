---
'mastracode': patch
---

Fixed background calls cancelled outside Mastra Code, for example through the HTTP cancel route, replaying as finished after a restart. They now replay as cancelled.
