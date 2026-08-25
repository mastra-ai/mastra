---
'@mastra/client-js': patch
---

Agent controller streams now recognize `thread_title_updated`, so it is narrowed by `isKnownAgentControllerEvent()` and reaches typed consumers like every other known event.
