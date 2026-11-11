---
'@mastra/factory': patch
---

Fixed large Factory boards slowing the server down every time a card changed. The server now re-reads only the cards that changed and rebuilds only their part of the board response, instead of reloading every card in the project. On a board of 7,200 cards, reading the board after a card change takes about 7 ms of processing instead of about 175 ms.
