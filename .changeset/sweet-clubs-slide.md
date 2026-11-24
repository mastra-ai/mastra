---
'@mastra/platform': patch
---

Reduced hosted Knowledge graph reads to a single request when the service supports it. The service accepts up to 500 pages, 5,000 notes, and 50 outside pages per request and refuses larger limits.
