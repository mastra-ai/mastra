---
'@mastra/react': patch
---

Fix type errors in `useChat` send-message flow after generated route body types tightened `requestContext` from `any` to `Record<string, unknown>`.
