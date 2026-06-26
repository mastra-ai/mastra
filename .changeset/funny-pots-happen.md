---
'mastracode': patch
---

Switched internal imports to the canonical `@mastra/core/agent-controller` entrypoint, replacing the deprecated `@mastra/core/harness` path and `Harness` types. Updated the web client to call `getAgentController()` and use the new `AgentControllerEvent` type, renamed the `useHarnessSession` hook to `useAgentControllerSession`, and renamed the `handleHarnessEvent` ACP mapper to `handleAgentControllerEvent`.
