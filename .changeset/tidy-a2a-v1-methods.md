---
'@mastra/client-js': patch
---

Fix `getA2AV1()` to send PascalCase A2A v1 JSON-RPC method names for message and task operations, enabling interoperability with v1-compliant servers. The v0.3 client is unchanged.
