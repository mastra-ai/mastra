---
'@mastra/memory': patch
---

Fixed ReDoS vulnerability in working memory tag parsing.

Replaced regex-based parsing with indexOf-based string parsing to prevent denial of service attacks from malicious input. The vulnerable regex `/<working_memory>([^]*?)<\/working_memory>/g` had O(n²) complexity on pathological inputs - the new implementation maintains O(n) linear time.
