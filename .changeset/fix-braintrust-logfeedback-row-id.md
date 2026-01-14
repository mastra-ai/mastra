---
"@mastra/braintrust": patch
---

Fix `logFeedback()` not working because span_id differs from row id.

**Problem**: When using `BraintrustExporter`, user feedback intended for specific agent responses appeared as separate rows in Braintrust rather than being attached to the original generation. The `startSpan()` call passed `spanId: span.id` but omitted the `event: { id: span.id }` parameter, causing Braintrust to auto-generate a different UUID for the row `id` field.

**Solution**: Add `event: { id: span.id }` to the `startSpan()` call so that the Mastra span ID is used as both the Braintrust `span_id` and row `id`. This allows `logFeedback({ id: span.id })` to correctly attach feedback to existing records.
