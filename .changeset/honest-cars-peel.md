---
'mastra': patch
---

Fixed Factory board cards offering a second run while one was still starting. After you click a run such as Review, its button now shows a disabled "Moving…" or "Starting…" until the run's session exists, then "Open session". While automation works on a card, the button names what it is doing ("Syncing…", "Retrying…"), matching the card's status line.

While a run or automation holds a card, its menu disables the actions that would start another run. Dragging the card into a lane that would start one, or picking it in global search, shows "Another run can't start while this card is busy." instead. Moves that start nothing stay available, so you can still close a held card, send it to review, or mark it done. While your own move, run or retry is in flight, the menu in the card's details panel also disables Remove and Dismiss suggested run.
