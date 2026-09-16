---
'@mastra/memory': patch
---

Fixed `recall` returning message content from outside the configured retrieval scope when called with `partIndex`.

`recall({ mode: "messages", cursor, partIndex })` resolved the cursor message without the ownership checks that the cursor-only path applies. With thread-scoped retrieval (`retrieval: { scope: "thread" }`), an agent that passed a message ID belonging to another resource or another thread received that message part in full. The identical call without `partIndex` was already refused, so `partIndex` was strictly more permissive than browsing.

**What changes**

- `partIndex` now respects the retrieval scope. An out-of-scope cursor fails with `Could not resolve cursor message` instead of returning content.
- In thread scope, a cursor belonging to another thread fails with the same generic `Could not resolve cursor message` error as an unknown cursor, so probing message IDs reveals nothing about threads the caller may not browse. Resource scope keeps the cross-thread guidance naming the other thread, where browsing another thread of the same resource is supported.

Resource-scoped retrieval can still browse another thread of the same resource and continue reading a truncated part there.

Fixes #21863
