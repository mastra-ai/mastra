---
'@mastra/factory': patch
---

Fixed the "ready — your turn" mark only going away when a session was opened from the sidebar. Opening the same thread through a board card, a deep link, or the attention inbox left the mark lit, and a run finishing in the very thread being read marked it as needing attention. Landing on a session's route — through any door — now dismisses its mark, and the open session never gets marked at all. The completion sound still plays for it, so a backgrounded tab still calls you back.
