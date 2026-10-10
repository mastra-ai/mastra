---
'@mastra/factory': patch
---

GitHub issues now land on the board set by their repository's intake source binding when no label route matches, instead of always arriving on Work. Label routes still take precedence, and when an issue's last routed label is removed — or its label route is cleared — its card returns to the binding's board.
