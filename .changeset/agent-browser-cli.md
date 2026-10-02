---
'@mastra/agent-browser': minor
'@mastra/browser-firecrawl': patch
---

`@mastra/agent-browser` now drives Chrome through the agent-browser CLI (0.38.1) instead of the old agent-browser 0.19 library. The CLI launches Chrome and produces the ref snapshots, and Playwright attaches over CDP for navigation, screencast and input. The tools and config are unchanged. This drops webdriverio and its vulnerable transitive dependencies (basic-ftp, extract-zip).

If no Chrome is installed, run `npx agent-browser install` or set `executablePath`.

`BrowserManager` is now exported from `@mastra/agent-browser`, and `@mastra/browser-firecrawl` imports it from there instead of depending on `agent-browser` directly.
