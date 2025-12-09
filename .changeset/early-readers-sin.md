---
'@mastra/inngest': patch
'@mastra/core': patch
---

Preserve error details when thrown from workflow steps

- Errors thrown in workflow steps now preserve full error details including `cause` chain and custom properties
- Added `SerializedStepResult` and `SerializedStepFailure` types for handling errors loaded from storage
- Added `serializeError` and `getErrorFromUnknown` utilities for error serialization/deserialization
- Added `hydrateSerializedStepErrors` to convert serialized errors back to Error instances
- Fixed Inngest workflow error handling to extract original error from `NonRetriableError` cause
