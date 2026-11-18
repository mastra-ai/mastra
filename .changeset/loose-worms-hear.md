---
'@mastra/factory': patch
---

Factory chat tabs no longer rebuild the full display state on every streamed chunk, which cuts main-thread time on long runs. Reloading or switching back to a thread mid-reply still shows the text so far and keeps streaming.
