---
'@mastra/factory': patch
---

Fixed `factory-complete-issue` never running when a Work card reaches Done. Terminal cleanup was revoking the card's bindings and superseding the close-out skill queued by the Done stage itself, so the skill was marked finished without running. Close-out work queued when a card enters a terminal stage now runs in a fresh binding, while work queued before the card finished is still cleaned up.
