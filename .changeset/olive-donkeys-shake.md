---
'@mastra/core': patch
---

Fixed a channel render driver failing early crashing the process. The `.catch()` on `driverPromise` in `ChatChannelOutputProcessor` logs and re-throws, and because `.catch()` returns a new promise, the re-throw rejected the promise handed back to the caller rather than the one it guarded. Nothing observes that promise until a terminal chunk (`step-finish`, `error`, `abort`) reaches `processOutputStream` and closes the queue. Text posts are defensively wrapped, but the tool-card post in `runStaticDriver` is not — so an adapter that rejects while a tool is running, such as an expired bot token, produced an unhandled rejection and took the process down with it. The rejection is now owned at creation; the `await session.driverPromise` at cleanup still observes the failure and still logs it.
