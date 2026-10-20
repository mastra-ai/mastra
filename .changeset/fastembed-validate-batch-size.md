---
'@mastra/fastembed': patch
---

Fixed FastEmbed accepting invalid batch sizes. `embed`, `passageEmbed`, and `countTruncated` now reject a `batchSize` that is not a positive whole number with a clear `RangeError` before any text is processed. Previously `batchSize: 0` caused an unrelated `TypeError` while embedding and could make `countTruncated` loop forever.
