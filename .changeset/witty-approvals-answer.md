---
'@mastra/core': patch
---

Fixed channel tool approval cards answering the wrong tool call. A supervisor re-raises every sub-agent approval inside one delegation under its own delegation call, so two sub-agent approvals shared one card id: a repeated or re-delivered Approve on the first card resumed the run against the second, still unanswered tool call, and the second card overwrote the first card's message. Each sub-agent approval now gets its own card id, action ids and message, and a click on a card that is no longer the delegation's newest is ignored so only the pending card can be answered.
