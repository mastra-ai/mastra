---
'@mastra/client-js': patch
---

Fixed thread and Agent Controller subscriptions retrying forever when reconnecting is denied. If a resubscribe request fails with a 4xx error (such as 401 or 403) or 501 Not Implemented, `processDataStream({ reconnect })` now rejects with the original error and Agent Controller `subscribe({ reconnect })` reports it through `onError`, instead of retrying. `408` timeouts, `429` rate limits, network failures and other server errors still retry within the reconnect limit.

If you relied on reconnect retrying 4xx responses, handle them by catching the `processDataStream` rejection or in `onError`:

```ts
try {
  await subscription.processDataStream({ onChunk, reconnect: true });
} catch (error) {
  if (error instanceof MastraClientError && error.status === 401) {
    // refresh credentials, then subscribe again
  }
}
```
