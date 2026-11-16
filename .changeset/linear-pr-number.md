---
'@mastra/factory': patch
---

Reading a pull request number from the end of a card's GitHub key now takes linear time, so a very long run of digits in the key no longer stalls it. The number returned is unchanged.
