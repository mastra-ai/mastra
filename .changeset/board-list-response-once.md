---
'@mastra/factory': patch
---

Made the Factory board lighter on the server. Open boards refresh their cards every few seconds, and the server now prepares a board's cards once and reuses them for every viewer until the board changes, instead of preparing them again for each refresh. Large boards with many viewers no longer keep the server busy.
