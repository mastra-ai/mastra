---
'@mastra/memory': patch
---

Fix schema-backed Observational Memory `Extractor`s throwing `Received input message with wrong resourceId. Input structured-observer, expected <resourceId>`.

The observer/reflector structured-extraction pass runs an internal `agent.generate` with a temporary `structured-observer` memory. That call was sharing the parent run's `RequestContext`, so it overwrote the `MastraMemory` entry with the temporary observer identity. The parent OM turn then read `resourceId: 'structured-observer'` from the polluted context and injected a continuation message that failed `MessageList`'s resourceId validation.

`withOmInternalThreadId` now always returns an isolated `RequestContext` clone (previously it returned the caller's context unchanged when no parent thread id was set), and the structured-extraction pass now runs on that isolated context, so internal memory writes can no longer leak back into the caller.
