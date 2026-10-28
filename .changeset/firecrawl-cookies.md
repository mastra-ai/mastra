---
'@mastra/browser-firecrawl': patch
---

`FirecrawlBrowser` supports `setCookies()`. Cookies set before a session's browser opens are added before its saved tabs reopen, so those pages load signed in.
