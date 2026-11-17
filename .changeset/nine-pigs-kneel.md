---
'@mastra/core': patch
---

Fixed durable agents sending the model a background tool's placeholder instead of its result. When a background tool finished while its `toModelOutput` was still running, or while a durable agent ran on storage version 2, the next model call saw the placeholder and the final save could write the placeholder over the stored result.
