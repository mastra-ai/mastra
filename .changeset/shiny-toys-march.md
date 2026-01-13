---
'@mastra/observability': minor
'@mastra/core': minor
---

Fix processor tracing to create individual spans per processor

- Processor spans now correctly show processor IDs (e.g., `input processor: validator`) instead of combined workflow IDs
- Each processor in a chain gets its own trace span, improving observability into processor execution
- Spans are only created for phases a processor actually implements, eliminating empty spans
- Internal agent calls within processors now properly nest under their processor span
- Added `INPUT_STEP_PROCESSOR` and `OUTPUT_STEP_PROCESSOR` entity types for finer-grained tracing
- Changed `processorType` span attribute to `processorExecutor` with values `'workflow'` or `'legacy'`
