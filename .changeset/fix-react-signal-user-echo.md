---
'@mastra/react': patch
---

Fixed Signal echoes not rendering or persisting the user message in `useChat`. The server emits the `data-user-message` echo with `data.type: 'user'`, but the `MastraDBMessage` accumulator only accepted `data.type: 'user-message'`, so live echoes fell through to the generic `data-*` handling and were attached as an opaque data part on the assistant message instead of becoming a user `MastraDBMessage`. The accumulator now accepts both discriminator values, matching the previous AI SDK behavior, so signaled user messages appear in the thread and are stored.
