---
'@mastra/playground-ui': patch
---

Fixed code blocks staying unhighlighted for the rest of the session after the syntax highlighter failed to load once (for example, stale chunks after a deploy or a network blip). The next code block now retries the load.
