---
'@mastra/core': patch
---

Added configurable response-based retry handling to `fetchWithRetry`.

Developers can now pass `shouldRetryResponse` to control which non-OK HTTP responses should be retried while network failures continue to retry automatically.

```ts
await fetchWithRetry(url, requestOptions, 3, {
  shouldRetryResponse: response => response.status === 429 || response.status >= 500,
});
```
