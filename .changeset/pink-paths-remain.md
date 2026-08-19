---
'@mastra/core': patch
---

Fixed a steer losing its identity once the run it interrupted was gone. `session.steer()` now tags the message it sends with `delivery: 'while-active'`, the same attribute a message sent to a busy agent carries, so the model still reads it as an interjection and a reloaded transcript can still tell it apart from a normal message.
