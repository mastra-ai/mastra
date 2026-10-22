---
'@mastra/factory': minor
---

Added `processors` to `FactoryIntegration`, so an integration can add input and output processors to every session run alongside its tools. Integration input processors run before Factory's own, and output processors run before the credential label, in the order integrations are listed. `initialize()` now also receives the controller's chat channels.

```ts
class MyIntegration implements FactoryIntegration {
  readonly id = 'my-integration';
  readonly processors = { input: [new MyInputProcessor()], output: [new MyOutputProcessor()] };
  routes() {
    return [];
  }
}
```

Slack now owns its reply tools and processors. `reply_in_thread` and `attach_file` are offered only on sessions linked to a Slack thread. When `adapterOptions.textDisplay` is `'show'`, the reply tool, its reminder and its streaming are no longer set up at all.
