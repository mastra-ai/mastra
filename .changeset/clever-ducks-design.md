---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/hono': patch
'@mastra/react': patch
'@mastra/deployer': patch
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mysql': patch
'@mastra/turso': patch
'@mastra/pg': patch
---

Fixed typed API error responses being collapsed into a plain message at the HTTP layer. Errors that carry a structured envelope — such as version-label conflicts (LABEL_MOVE_CONFLICT), unsupported-storage responses (VERSION_LABELS_UNSUPPORTED), and invalid version selector rejections — now reach clients with their `{ error: { code, message, details } }` body intact, so Studio and SDK callers can drive conflict review and recovery flows instead of showing a generic error.
