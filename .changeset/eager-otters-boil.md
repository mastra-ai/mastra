---
'@mastra/factory': patch
---

Factory storage can now hold one issue or pull request on several boards at once, each board with its own card. The record itself is stored once and linked to every card, and each link holds the record's facts for that card; facts synced from GitHub, GitLab, Linear, Jira, incident.io and Vanta (state, labels, author, title) reach every card in one write, and each card runs its own board's rules when the record changes. Deleting one card keeps the record and its other cards. Existing cards keep working as they are and are linked the next time their record syncs.

Every card of a record takes part in intake and card moves:

- Label and assignee changes reach the record's card on every board.
- A card-move rule that would put a card onto a board already holding a card for the same record is skipped and listed as skipped, instead of retrying forever.
- Route again and refiling put a record on the card that board already holds.
- The intake tester on a board's Rules page answers for that board's card, and the intake dry run counts each record once, as its first card.
- A pull request that closes an issue is linked to the issue's card on every board, and an outsider's pull request stays untrusted on each, including cards added to a board later.
- A renamed Linear issue is matched to a live card on each board, considering only cards filed from Linear.
