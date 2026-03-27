---
'@mastra/datadog': patch
---

Fixed error messages in Datadog being mangled by tag normalization (colons splitting into key/value pairs, spaces becoming underscores, truncation). Error message text is now stored in span metadata instead of tags, which preserves the original content. Structured error fields (error status, id, domain, category) remain as tags.
