---
'@mastra/browser-firecrawl': minor
---

Added `setCookies()` support to `FirecrawlBrowser`. Cookies set before a thread's browser opens are added before it loads any page, so pages open signed in.
