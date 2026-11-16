---
'@mastra/pinecone': patch
---

Fixed Pinecone queries ignoring the other conditions in a filter that also uses `$all`. A filter such as `{ resource_id: "alice", topic: { $all: ["x", "y"] } }` now matches only records where every condition holds, instead of only the `$all` part. `$all` on nested fields now uses the full field path.
