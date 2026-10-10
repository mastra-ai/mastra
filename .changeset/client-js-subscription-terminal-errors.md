---
'@mastra/client-js': patch
---

Fixed thread and Agent Controller subscriptions retrying forever when reconnecting is denied. If a resubscribe request fails with a client error such as 401 or 403, `processDataStream({ reconnect })` now rejects with the original error and Agent Controller `subscribe({ reconnect })` reports it through `onError`, instead of retrying. Network failures and server errors still retry within the reconnect limit.
