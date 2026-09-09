---
'@mastra/client-js': patch
'@mastra/deployer': patch
'@mastra/core': patch
---

Keep an explicitly selected controller thread bound before opening or reconnecting its event stream. Pass threadId to session.subscribe and use a separate session scope for each open thread.
