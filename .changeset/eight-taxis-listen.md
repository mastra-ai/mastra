---
'create-mastra': patch
'@mastra/core': patch
---

Fixed an issue where if @mastra/core was not released at the same time as create-mastra, create-mastra would match the alpha tag instead of latest tag when running npm create mastra@latest
