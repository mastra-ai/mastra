---
'@mastra/factory': patch
---

Fixed Linear updates for an issue Linear renamed when it has cards on several boards. A live card filed under an older identifier is now picked for its board over a finished card from the issue's other old identifiers, and only cards filed from Linear are considered.
