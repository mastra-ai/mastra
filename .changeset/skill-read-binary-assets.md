---
'@mastra/core': patch
---

Fixed the `skill_read` tool corrupting binary skill files. A PNG or PDF is now reported as `Binary file: <path> (<bytes>)` with its exact size and is never decoded into the model context. Previously the file was decoded as UTF-8 before its bytes were inspected, which inflated the byte count and could put garbled text into the conversation. Binary detection now also covers NUL-free binaries such as PDFs. Text files anywhere in the skill, including under `assets/`, still read as text.
