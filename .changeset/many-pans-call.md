---
'@mastra/client-js': patch
---

Fixed memory thread write methods (`update`, `delete`, `deleteMessages`, `clone`) silently sending requests without the required `agentId`. The methods now resolve `agentId` from a per-call argument first, then the constructor, and throw a clear error if neither is set — before any HTTP request is issued. Reads are unchanged.

Fixed `MastraClient.deleteThread()` issuing `DELETE /api` (an empty URL) when called without `agentId` or `networkId`. The method now requires exactly one of the two, enforced both at runtime and in the type signature.
