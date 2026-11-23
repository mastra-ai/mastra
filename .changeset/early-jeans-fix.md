---
'@mastra/core': patch
---

Fixed slow processing of long streamed words in the PII detector, which could stall output when a response contained a very long unbroken token or a long run of letters with no email address in it.
