---
'@mastra/code-sdk': patch
---

Teach the main agent about its subconscious. When the experimental subconscious is enabled, the system prompt now carries a "Subconscious Memory" section that explains what the background memory system does, how to use `knowledge_search` / `knowledge_read` / `knowledge_browse`, and that `ask_memory` is asynchronous with its answer arriving later as `<remind-answer>` signals. Previously the agent saw only the one-line tool descriptions and effectively never used them.
