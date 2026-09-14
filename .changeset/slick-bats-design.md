---
'@mastra/playground-ui': patch
---

Added the chat message rendering primitives (text, reasoning, data/signal and file renderers, signal/tripwire/system-reminder badges, message metadata types) under `@mastra/playground-ui/domains/chat/messages/*`, and the attachment helpers (`classifyAttachment`, `isTextMimeType`, preview dialog entries) under `@mastra/playground-ui/domains/chat/attachments/*`. `MessageMetadata`, signal data helpers and `readToolPart`/`isToolPart` are also exported from `@mastra/playground-ui/domains/chat`. These were previously internal to the Studio app and can now be reused by other hosts.
