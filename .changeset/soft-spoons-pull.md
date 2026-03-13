---
'@mastra/memory': patch
---

Added durable observation group metadata to observational memory so each observation can be tied back to the raw message ID range it summarizes.

Grouped reflections now use a two-representation flow: canonical XML storage keeps `<observation-group>` provenance intact, while the Reflector edits a Markdown rendering with ephemeral ordinal anchors and derived-group reconciliation.

This is groundwork for graph-mode memory, where the actor can use those ranges to fetch the underlying raw message history when the stored observation summary is not enough.
