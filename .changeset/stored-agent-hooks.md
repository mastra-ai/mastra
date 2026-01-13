---
"@mastra/playground-ui": patch
"@mastra/client-js": patch
---

Add stored agent hooks and requestContext support

- Add `useStoredAgents` hook for listing stored agents with pagination
- Add `useStoredAgent` hook for retrieving a stored agent by ID
- Add `useStoredAgentMutations` hook for create/update/delete operations
- Add `requestContext` support to all stored agent client methods
