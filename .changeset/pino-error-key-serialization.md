---
'@mastra/loggers': patch
---

Fixed Errors logged under the `error` key being recorded as an empty object.

Pino only applies its error serializer to the `err` key, and an Error's `message` and `stack` are non-enumerable. So `logger.warn('...', { error })`, the convention used throughout Mastra, was written as `error: {}` and the real failure was lost. The most visible symptom was `Error listing tools for agent` with no details.

`PinoLogger` now applies Pino's standard error serializer to the `error` key as well, so the type, message, and stack are recorded. The built-in `err` key keeps working. Values under `error` that are not error-like (no string `message` property) are passed through unchanged. Error-like plain objects are normalized to the same `{ type, message, stack }` shape with their own fields preserved.

A new `serializers` option lets you override or extend the defaults:

```ts
new PinoLogger({
  serializers: { error: err => ({ message: err.message }) },
});
```
