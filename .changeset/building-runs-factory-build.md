---
'@mastra/factory': minor
---

Building on the default Work board is now a status rather than an instruction. When a card enters Building (for example after its plan is approved), Factory sets a goal on the card's session — implement the approved plan and hand the change on — and the session's goal judge keeps the run going until that is done. Nothing new is sent to a session that is already building.

When self-review sends a card back, Building activates the new bundled `factory-build` skill with the findings, so changing Building's skill in Settings › Boards changes how findings are handled.

Rule handlers can start a goal the same way: `{ type: 'invokeSkill', idempotencyKey, role: 'work', goal: 'Ship the fix with tests.' }`.
