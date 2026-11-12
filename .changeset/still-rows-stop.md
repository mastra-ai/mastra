---
'mastracode': patch
---

Fixed background calls cancelled outside Mastra Code, for example through the HTTP cancel route, so they replay as cancelled when a thread loads.
