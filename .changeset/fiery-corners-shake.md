---
'@mastra/factory': patch
---

Factory automations whose board move is refused now fail at once and reach a person. Before, the dispatcher retried the same refusal four more times over about fifteen seconds before giving up, because a retry only replays the refusal already recorded for that move. Moves refused because the card changed concurrently are still retried.
