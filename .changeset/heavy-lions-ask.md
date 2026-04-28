---
'@mastra/core': patch
---

Fixed several processor bugs: BatchPartsProcessor no longer drops non-text parts (tool calls, step events) when they trigger a text batch flush. PIIDetector now correctly applies the confidence threshold to individual detections instead of flagging any detection regardless of confidence. Added missing break/return statements after abort() calls in PII detector and language detector switch statements. Unified error handling across all LLM-based processors to consistently use abort() for proper tripwire tracking in observability spans.
