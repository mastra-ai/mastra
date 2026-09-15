---
'@mastra/factory': minor
---

Added Linear team intake sources so Factory boards can ingest active projectless issues while preserving project precedence for overlapping selections.

Kept one live card per Linear issue across Factories: when an issue's winning source moves to a source routed to another Factory, the Factory that already holds the card keeps it instead of a second card being minted. The issue detail route keeps serving a card its Factory already holds after such a change, fetching through the selected sources only.
