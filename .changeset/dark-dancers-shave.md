---
'mastra': patch
'mastracode': patch
---

Fixed analytics user tracking to use a private persistent ID instead of the device hostname, so unique user counts are not merged across machines with common names.
