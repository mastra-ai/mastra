---
'@mastra/factory': minor
---

Asking a Factory session to work on a card now goes through the board, the way the board's own buttons do. Before, asking a Slack or web session to "review" a pull request that already had a card often ended in a side session posting its review in the chat, while the card's own review waited for approval.

- `factory_transition_work_item` can now run the stage a card is already in again, as the board's **Start** button does. The run counts as approved by the person asking, and a busy card is refused as on the board. A rerun needs a person in the turn.
- Every tool that takes a work item also accepts the issue or pull request it tracks: its link, `owner/repo#12`, `group/project!7`, or a tracker key such as `ENG-42`. With several repositories linked, the link finds the right card where a bare `#12` might not. `factory_list_work_items` takes the same references as its query.
- `factory_inspect_work_item` lists the card's stage, whether it can run again, and the stages its board lets it move to next.
- `factory_start_session` only starts side sessions. Its `workItem` and `role` inputs are removed: they started a card's role without the board's rules, such as which stage the card is in and whether it is busy.
