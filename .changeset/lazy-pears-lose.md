---
'@mastra/factory': patch
---

Fixed Factory cards that hand off to their next stage mid-turn reading as idle while the hand-off was still running. A stage's run is now on record from the moment its work reaches the session, rather than only once the turn that handed the card on had ended, so run state and anything watching it can tell a busy agent from a stopped one.
