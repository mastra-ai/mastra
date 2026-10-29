---
'@mastra/livekit': patch
---

Fixed a build failure when `@livekit/protocol` resolves to a different version than the one `livekit-server-sdk` depends on. Room configuration types are now imported from `livekit-server-sdk` so they always match the `AccessToken` they are assigned to.
