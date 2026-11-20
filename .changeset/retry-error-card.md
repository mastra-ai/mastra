---
'@mastra/core': minor
'@mastra/factory': patch
---

Added a Retry button to channel error cards. Put `Button({ id: CONTINUE_RUN_ACTION_ID })` (exported from `@mastra/core/channels`) on a card returned from `formatError`. When someone clicks it, the agent receives `Continue.` from that person, routed through `onSubscribedMessage` like a reply in the thread. Factory Slack error cards now show **Retry** for failures that continuing the run can fix, such as timeouts, rate limits and unavailable providers.
