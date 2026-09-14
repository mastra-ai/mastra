---
'@mastra/temporal': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Background tool results on the durable engine now apply configured transcript transforms, so payloads a user asked to redact are no longer persisted raw to thread history. They also use the configured Mastra `idGenerator` for appended message ids instead of falling back to random UUIDs.
