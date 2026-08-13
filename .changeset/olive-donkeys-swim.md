---
'@mastra/memory': patch
---

Add opt-in pinned knowledge to Subconscious memory. A pin is a knowledge fact on a reserved entity: the curator maintains the set with `knowledge_pin`, `knowledge_edit_pin`, and `knowledge_unpin`, and a state processor projects it onto the state-signal lane, emitting a snapshot when none is in the visible context, a delta when one is, and nothing when the set is unchanged. Off by default; `maxPins` and `maxCharacters` (total across the set) are enforced in the pin tools.

Removes the never-released `./pins` exports (`publishSubconsciousPinned`, `buildSubconsciousPinnedSnapshot`, `renderSubconsciousPinned`, `PINNED_KNOWLEDGE_PAGE`, `SUBCONSCIOUS_PINNED_STATE_ID`) in favor of the `./pinned` surface, and changes `pins.maxCharacters` from a per-page body limit to the total pin-set budget. Both existed only on this unmerged branch, so this is not a breaking change for any released version.
