---
'@mastra/pg': patch
---

Knowledge timestamps now read back as UTC. The knowledge domain stores UTC digits in timezone-naive columns, but reads re-interpreted them in the server's local timezone, shifting every capturedAt/createdAt/updatedAt by the host's UTC offset (facts appeared to be captured in the future on non-UTC hosts). Reads now reinterpret the stored digits as UTC and pagination cursors render UTC digits to match.
