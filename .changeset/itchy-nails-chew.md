---
'@mastra/braintrust': minor
---

**Breaking change**

Updated the bundled Braintrust SDK from v2 to v3 and replaced the SDK-specific logger and span types with stable Mastra interfaces/shims. Compatible Braintrust v2 and v3 logger and span objects remain supported.

Braintrust v3 uses a separate W3C trace ID for `root_span_id`. Mastra's returned `spanId` remains the Braintrust row ID and span ID for feedback and lookup.

**Migration**

The `BraintrustExporterConfig` interface changed, so if you were using the `braintrustLogger` field or the `getCurrentSpan()` method, those now hold narrower types that are no longer tied to the Braintrust SDK. It is unlikely that this is affecting you but technically a breaking change, which is why it is outlined.

Applications that independently upgrade Braintrust and use Nunjucks prompt templates should follow the Braintrust v2 to v3 migration guide: https://www.braintrust.dev/docs/sdks/typescript/migrations/v2-to-v3
