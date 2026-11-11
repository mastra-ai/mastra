---
'mastra': patch
---

Improved Factory boards so you can see where a card's work happens and why it moved:

- Clicking a card opens the session for the phase it is in now, not its first session. The card's details list all of its sessions by context (Triage, Work, Review) and mark the current one.
- The sessions sidebar groups a card's sessions under the card's title, each named by its context.
- A card's session page names that session's context in the breadcrumb, and says which phase the card is in now when it has moved on.
- A card sent back to an earlier phase says so, for example "Back from Review", with the reason: self-review's findings, or the agent's explanation for the move. The card's details show the full reason.
- Board columns and list groups show the tool that ends a phase, such as `submit_plan` for Planning, and whether a person approves it.
