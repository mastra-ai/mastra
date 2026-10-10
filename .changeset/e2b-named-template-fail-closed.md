---
'@mastra/e2b': minor
---

Added a fail-closed option for named E2B templates. Set `fallbackTemplate: false` on a `NamedTemplateSpec` to make `start()` reject with the original error when the named build fails or the resolved template can't create a sandbox, instead of silently booting the default template without your toolchain. Default behavior is unchanged.

```ts
const sandbox = new E2BSandbox({
  template: { ref: 'my-tools:v1', template: myTemplate, fallbackTemplate: false },
});
```
