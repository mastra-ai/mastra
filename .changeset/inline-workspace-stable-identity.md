---
'@mastra/editor': patch
---

Derive inline workspace identity from a canonical, key-order-independent hash so semantically equivalent configs resolve to the same `inline-<hash>` ID. Previously the ID was hashed from raw `JSON.stringify`, which preserves object insertion order, so reordered-key configs produced different IDs and created duplicate stored workspaces with unstable references. Array order and value differences remain significant.
