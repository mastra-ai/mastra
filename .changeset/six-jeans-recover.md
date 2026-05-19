---
'@mastra/server': patch
---

Harness sessions can now recover from disconnections. Remote clients can resume event streaming with `Last-Event-ID` and retrieve results for interrupted message or queue operations.

```ts
const eventStream = await fetch(`/harness/${name}/sessions/${sessionId}/events`, {
  headers: { 'Last-Event-ID': lastEventId },
});

const messageResult = await fetch(
  `/harness/${name}/sessions/${sessionId}/message-results/${signalId}`,
).then(response => response.json());

const queueResult = await fetch(
  `/harness/${name}/sessions/${sessionId}/queue/${queuedItemId}/result`,
).then(response => response.json());
```
