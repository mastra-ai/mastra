---
'@mastra/rag': patch
---

Fixed Markdown chunking so headings that contain a pipe character, such as `# API | Reference`, are recognized as headings. They now set heading metadata, split chunks, and are removed when `stripHeaders` is true, instead of being treated as table rows. Real tables and fenced code are unchanged.
