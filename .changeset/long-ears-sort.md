---
'@mastra/core': minor
---

Fixed potential credential leakage in observability spans. LLM API keys, authentication headers, and gateway tokens could previously appear in span input or output data sent to telemetry backends.

**What's fixed**

The model router, AI SDK model wrappers (v4 legacy, v5, v6), built-in gateways (Mastra, Netlify, Models.dev, Azure OpenAI), and the voice provider base class now restrict what they expose to spans. Only public identity fields — model ID, provider, gateway ID, voice name — are included. Private configuration such as API keys, `Authorization` headers, OAuth tokens, and proxy credentials is no longer serialized into spans.

Legacy AI SDK v4 models passed to `resolveModelConfig` were previously returned unwrapped. They are now wrapped in `AISDKV4LegacyLanguageModel`, which applies the same `serializeForSpan()` safety as the v5/v6 wrappers while preserving the `LanguageModelV1` interface so existing consumers continue to work.

The `SensitiveDataFilter` span output processor already redacted values under common field names (`apiKey`, `token`, `authorization`, etc.) when enabled. This fix closes the gap for users who did not have it configured, and for cases where credentials were nested under custom field names that the filter's exact-match list did not cover.

**Recommended action**

- Review existing telemetry data for leaked credentials and rotate any keys that may have been captured.
- Custom gateways extending `MastraModelGateway` and custom voice providers extending `MastraVoice` are automatically covered — they inherit the new safe default. Override `serializeForSpan()` only if you want to expose additional non-sensitive fields.
- For any other class you pass into a span (e.g. as `input`, `output`, `attributes`, or `metadata`) that holds enumerable fields with credentials or other sensitive state, add a `serializeForSpan()` method. TypeScript-`private` properties are still walked by span serialization because `private` is compile-time only.

```ts
class MyServiceClient {
  constructor(private config: { apiKey: string; endpoint: string }) {}

  // Without this, spans carrying a MyServiceClient instance would
  // serialize `config.apiKey` through every enumerable property.
  serializeForSpan() {
    return { endpoint: this.config.endpoint };
  }
}
```
