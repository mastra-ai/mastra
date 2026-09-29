---
'@mastra/core': patch
---

Fixed the durable agent engine leaking raw tool output when an output or result processor throws. Previously, if a processor (for example a redaction processor) failed with a non-tripwire error, the durable engine would warn and continue with the unprocessed value: the raw tool result was still emitted on the stream and persisted to the transcript. Both paths now fail closed — a throwing stream processor suppresses the chunk instead of emitting the original, and a throwing tool-result processor substitutes an error placeholder for both emission and persistence. The run itself stays alive in both cases. This matches the regular loop, which already refused to emit or persist raw values when a processor throws.
