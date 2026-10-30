---
'@mastra/code-sdk': patch
---

Fixed OpenAI Codex (ChatGPT sign-in) threads failing with `Item with id 'rs_…' not found` after sitting idle. Earlier reasoning and message items are now replayed without their server ids, so a resumed thread no longer depends on Codex still caching them.
