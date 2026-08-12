---
'@mastra/observability': minor
---

Added an `indexed` redaction style to `SensitiveDataFilter`. Instead of collapsing every sensitive value to the same `[REDACTED]` string, each unique value gets a stable token derived from the matched field name, like `[APIKEY_1]`. The same value maps to the same token across all spans of a trace, so redacted traces keep their referential structure (you can tell whether two redacted fields held the same secret or different ones) without exposing the raw values. Token numbering restarts for each trace, so values cannot be linked across traces.

```ts
new SensitiveDataFilter({
  redactionStyle: 'indexed',
});
```

See [#21313](https://github.com/mastra-ai/mastra/issues/21313)
