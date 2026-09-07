---
'@mastra/factory': patch
---

Fixed supervisor findings refreshing the Attention inbox on every health tick. A finding now keeps the moment its condition began, so a tick that finds nothing new writes nothing, and the inbox orders findings by when they opened.
