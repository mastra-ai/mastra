---
'@mastra/code-sdk': patch
'@mastra/core': minor
---

Avoid blocking the event loop while loading instruction files from a trusted Git ref and while discovering tool-result instruction reminders. Keep missing and untrusted-ref behavior unchanged.

`AgentsMDInjector` now accepts asynchronous reader callbacks. For example, `getReader: async () => ({ pathExists: async path => ..., isDirectory: async path => ..., readFile: async path => ... })` lets an instruction reader use nonblocking filesystem or Git operations. Existing synchronous readers remain supported.
