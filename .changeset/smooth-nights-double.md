---
'@mastra/factory': patch
---

Board polls after a card edit no longer reload every card in the project. Factory now re-reads only the cards that changed when the edit was made on the same server, which keeps busy boards responsive.
