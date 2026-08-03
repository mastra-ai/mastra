---
'@mastra/playground-ui': patch
---

Fixed three problems with the conversation rail in chat threads.

**The rail now marks the turn you are reading after older history loads.** Scrolling up to load earlier messages used to leave the oldest message highlighted as the current turn, so the marker jumped to the top of the thread instead of following the transcript.

**Scrolling stays responsive in long threads.** The rail re-derived the order of every message on each scroll event. It now does that only when messages are added or removed.

**The rail can be used in a browser-only app.** Importing it no longer drags the whole `@mastra/react` entry point into the bundle.
