---
'mastracode': patch
---

Added conversation branching commands to the TUI. `/branch` forks the current thread at its latest message into a shared-history branch, `/parent` switches from a branch back to its source thread, and `/branches` lists branches forked from the current thread and jumps to a pick. Thread views now render fork-point markers inline: source threads show where each branch forked, and branch threads show where they forked from.
