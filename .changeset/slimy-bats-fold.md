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

Fixed the missing run version identity on thread subscriptions. A run started through agent signals or queued messages now broadcasts a resolved-version-overrides chunk to thread subscribers before its first stream part, so clients such as Studio can show the immutable version a selected label resolved to for the current run. Only exact version selections are broadcast — never per-caller continuation tokens.
