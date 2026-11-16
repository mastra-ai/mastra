---
'@mastra/core': minor
---

`AgentChannels` can now move or remove a chat thread's mapping with `agent.getChannels()?.mapThread({ platform, externalThreadId, threadId, externalChannelId? })` and `agent.getChannels()?.unmapThread({ platform, externalThreadId })`. Unmapping an account stops runs on the thread from posting to it and stops the account's messages from being delivered into it, while the thread and its history are kept; mapping points an account at a thread you already have. Previously the mapping was written once when a thread was created and there was no supported way to change it.

Channel metadata writes (`subscribe`, `unsubscribe`, the last-sender bookkeeping, and the legacy owner claim) now patch only the keys they own, so a mapping removed while a message is being handled can no longer be restored by those writes. A signal that addresses a run through another resource or thread is refused instead of being delivered into it.
