---
'@mastra/factory': patch
---

Fixed sessions woken by a pull request comment or close failing with `missing-user-context` or `No usable openai credential`. Woken runs now execute as the user who subscribed, with that organization's credentials available.
