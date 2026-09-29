---
'@mastra/core': patch
---

Stream chunks now carry the id of the persisted assistant message they belong to. Previously only `step-start` announced the message id, so consumers of the raw chunk stream (for example a custom reducer on `subscribeToThread`) couldn't tell which saved message a chunk belonged to after a reconnect, late join or reload once the id rotated mid-run.

```ts
for await (const chunk of stream.fullStream) {
  if (chunk.messageId) {
    // attribute chunk to the persisted message with this id
  }
}
```

Signal chunks (`data-signal`, `data-user-message`) carry the id of their own saved signal message. Run lifecycle chunks such as `start`, `finish` and `abort` don't carry a `messageId`.
