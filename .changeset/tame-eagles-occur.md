---
'@mastra/core': patch
---

Fixed stored working memory and memories recalled from other conversations being able to break out of their section of the system prompt. Text that spells out the section's closing tag (for example `</working_memory_data>`) is now escaped. Recalled messages from other conversations now appear one per line (they used to run together), and multi-line recalled content is indented so it can't look like a separate recalled message. Fixes [#24192](https://github.com/mastra-ai/mastra/issues/24192).
