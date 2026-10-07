---
'@mastra/core': patch
---

Fixed agent channel credentials leaking into traces. Channel runs no longer export the live platform adapter and chat thread on every span's `requestContext`, so Telegram/Slack bot and app tokens no longer end up in observability storage, and spans no longer grow by hundreds of KB.

Class instances, functions, and Maps/Sets nested inside plain objects in `requestContext` are now shown as `[object]`/`[function]` in traces instead of having their internals exported. Plain nested data stays visible.
