---
'@mastra/memory': patch
---

Fixed semantic recall re-embedding the same text on every save. Saving messages whose text was already embedded by this Memory instance (a repeated reply, a re-saved message, a cloned thread) now reuses the stored vectors instead of calling the embedder again, while each message still gets its own vector row. Reused vectors are not counted again in the reported embedding usage.
