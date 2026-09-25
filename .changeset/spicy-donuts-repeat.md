---
'@mastra/core': patch
---

Knowledge nodes created with an external address no longer coalesce onto an existing node that happens to share the same name in the same scope. Address-bound nodes are identified by their address, not their name, so two distinct source entities with the same title (for example two imported pages titled "Dynamic Workflows") now become two nodes instead of silently merging — previously the second entity's address was bound to the first entity's node, which then tripped the importer ownership guard and deterministically bricked the sync run on every retry.

`createNodeWithAddress` now throws `KnowledgeConflictError` on a live same-name sibling, and the static importer handles it by retrying with a deterministic address-derived suffix (`Dynamic Workflows (02c161)`). The suffix self-heals back to the plain name once the colliding node is gone. Idempotency by address is unchanged: re-upserting an already-bound address returns its node regardless of the requested name.
