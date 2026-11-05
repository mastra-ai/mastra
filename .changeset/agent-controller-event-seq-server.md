---
'@mastra/server': minor
---

Agent controller session streams now number their events. Every event on `GET /agent-controller/:controllerId/sessions/:sessionId/stream` carries a `seq`, and the display-state snapshot that opens the stream carries the `seq` of the session's last event. A client that reconnects and gets the same `seq` it last received missed nothing and can skip re-reading the thread.

```ts
let lastSeq: number | undefined;
let reconnecting = false;

function onStreamEvent(event: { type: string; seq?: number }) {
  if (reconnecting && event.type === 'display_state_changed') {
    reconnecting = false;
    if (event.seq !== lastSeq) {
      // events were missed while disconnected: re-read the thread
    }
  }
  lastSeq = event.seq;
}
```
