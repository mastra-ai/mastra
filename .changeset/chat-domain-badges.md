---
'@mastra/playground-ui': patch
---

Added a `chat` domain (`@mastra/playground-ui/domains/chat`) exposing the shared chat context hooks (`useChatRunning`, `useChatSend`, `useChatMessages`, `useChatTasks`) and the presentational tool-call badge primitives (`BadgeWrapper`, `SectionLabel`, `LoadingBadge`, `NetworkChoiceMetadataDialogTrigger`) so they can be reused outside of Studio.
