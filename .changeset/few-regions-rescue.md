---
'@mastra/memory': patch
---

Fixed stored working memory and messages from other conversations being able to break out of their section of the system prompt when using `Memory.getSystemMessage()`, `Memory.getContext()`, or observational memory with resource scope. Text that spells out the section's closing tag (for example `</working_memory_data>` or `</other-conversation>`) is now escaped. Fixes [#24192](https://github.com/mastra-ai/mastra/issues/24192).
