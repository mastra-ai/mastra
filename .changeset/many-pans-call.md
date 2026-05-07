---
'@mastra/client-js': patch
---

Fixed memory thread write methods (`update`, `delete`, `deleteMessages`, `clone`) silently sending requests without the required `agentId`. The methods now resolve `agentId` from a per-call argument first, then the constructor, and throw a clear error if neither is set — before any HTTP request is issued. Reads are unchanged.

```ts
// Either set agentId on the thread once...
const thread = client.getMemoryThread({ threadId: 't1', agentId: 'a1' });
await thread.update({ title: 'Renamed' });
await thread.delete();

// ...or pass it per call.
const thread = client.getMemoryThread({ threadId: 't1' });
await thread.update({ agentId: 'a1', title: 'Renamed' });
await thread.delete({ agentId: 'a1' });
```

Fixed `MastraClient.deleteThread()` issuing `DELETE /api` (an empty URL) when called without `agentId` or `networkId`. The method now requires exactly one of the two, enforced both at runtime and in the type signature.

```ts
await client.deleteThread('t1', { agentId: 'a1' });
await client.deleteThread('t1', { networkId: 'n1' });
```
