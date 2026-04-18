---
'@mastra/core': patch
---

Fixed credential leakage in observability spans. LLM API keys, authentication headers, and gateway tokens could previously appear in span input or output data sent to telemetry backends like Datadog or OpenTelemetry collectors.

**What's fixed**

The model router, built-in gateways (Mastra, Netlify, Models.dev, Azure OpenAI), and the voice provider base class now restrict what they expose to spans. Only public identity fields — model ID, provider, gateway ID, voice name — are included. Private configuration such as API keys, `Authorization` headers, OAuth tokens, and proxy credentials is no longer serialized into spans.

**Recommended action**

- Review existing telemetry data for leaked credentials and rotate any keys that may have been captured.
- If you maintain a custom gateway or voice provider, add a `serializeForSpan()` method to control what appears in spans. Every enumerable field on the class is otherwise serialized, including TypeScript-`private` properties.

```ts
class MyGateway extends MastraModelGateway {
  readonly id = 'my-gateway';
  readonly name = 'My Gateway';

  constructor(private config: { apiKey: string }) {
    super();
  }

  // Inherits a safe default from MastraModelGateway that returns
  // only { id, name }. Override only if you need to expose more.
  serializeForSpan() {
    return { id: this.id, name: this.name };
  }
}
```
