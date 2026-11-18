---
'mastra': patch
---

Improved starting a session from a Factory card: sending the first message no longer swaps the page for a new one. The message shows as soon as you send it, and when the session's thread opens, the conversation, composer, header, stage bar and session panel stay on screen instead of loading and animating in again. The composer keeps its focus, its model and anything typed while the session starts.

The same holds when a suggested action such as Review or Investigate starts the card's session: its thread opens in the same conversation and loads its history there, with the card's stage bar and session panel already filled in, instead of replacing the composer.

Switching to another session from the sidebar, or opening one from a link, keeps the current page until the next session's stage bar and panel are ready, so they appear complete instead of loading in. Opening a session's address directly still shows the page right away.

Fixed the first message from a card sometimes never being sent and landing back in the composer. A start that failed after linking the card to its session now keeps your message on the card with the error, instead of opening the thread without it.
