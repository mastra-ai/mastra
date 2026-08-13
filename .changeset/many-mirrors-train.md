---
'@mastra/observability': minor
---

Added an `indexed` redaction style to `SensitiveDataFilter`. Instead of collapsing every sensitive value to the same `[REDACTED]` string, each unique value gets a stable token derived from the first matched field name, like `[APIKEY_1]`.

```ts
new SensitiveDataFilter({
  redactionStyle: 'indexed',
});
```

See [#21313](https://github.com/mastra-ai/mastra/issues/21313)
