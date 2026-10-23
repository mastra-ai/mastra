---
'@mastra/browser-firecrawl': patch
---

Limited the `agent-browser` peer dependency to `>=0.19.0 <0.20.0`. From 0.20.0, `agent-browser` ships only a command-line binary with no JavaScript API, so `FirecrawlBrowser` failed to load with "Failed to resolve entry for package agent-browser" when a newer version was installed.
