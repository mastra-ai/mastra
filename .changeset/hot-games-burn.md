---
'@mastra/factory': patch
---

**Session status**

- Fixed session status disagreeing between sidebar rows, board cards, and the open chat.
- Running, setting up, and waiting-on-you states now read the same after a reload and in every tab.
- Removed the per-browser "your turn" mark; a card waiting on a person is marked from the card itself, and a finished session with nothing waiting shows as idle.

**Chat**

- Fixed the favicon claiming the session awaits input while history is still loading.
- Allow steering or stopping a running session as soon as it is connected.

**Done sound**

- Plays once when a run watched in this tab ends.
