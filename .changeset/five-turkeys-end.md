---
'@mastra/inngest': patch
'@mastra/server': patch
'@mastra/core': patch
---

Updated `watch` and `watchAsync` methods to use proper function overloads instead of generic conditional types, ensuring compatibility with the base Run class signatures.
