---
'@mastra/core': patch
---

Fixed output stream processors that hold parts (such as `BatchPartsProcessor` and `PIIDetector`) re-emitting or leaking text when a model call failed. When a call is retried, the dropped attempt's text is no longer repeated before the retry's reply. When a call errors or is aborted, the text it was holding is dropped instead of being sent, and the error or abort still reaches the caller. Parts a processor holds back and sends again now reach the stream instead of getting stuck, so the reply's `text-end` is no longer lost.
