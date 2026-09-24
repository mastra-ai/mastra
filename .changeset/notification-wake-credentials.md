---
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Fixed notification-triggered runs in Factory failing with "No usable anthropic credential is configured". A notification that wakes an idle thread now runs as the session's owner in the session's organization, so tenant credentials resolve. `@mastra/code-sdk` adds a `prepareNotificationRequestContext` option for hosts to attach that identity.
