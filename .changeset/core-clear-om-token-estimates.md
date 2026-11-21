---
'@mastra/core': patch
---

Message parts that Mastra edits (streamed text, committed tool results, working-memory stripping, and the built-in processors that rewrite text) now drop the token count Observational Memory stored on them, so OM counts the new content. Token counts on messages passed in to `agent.generate()` or `agent.stream()` are dropped too.
