---
'@mastra/factory': minor
---

Added `processors` to `FactoryIntegration`. An integration can now add input and output processors to every session run, alongside its tools. They run before Factory's own processors, in the order integrations are listed. `initialize()` now also receives the controller's chat channels.

```ts
class MyIntegration implements FactoryIntegration {
  readonly id = 'my-integration';
  readonly processors = { input: [new MyInputProcessor()], output: [new MyOutputProcessor()] };
  routes() {
    return [];
  }
}
```
