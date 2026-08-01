---
'mastracode': patch
---

Fixed severe TUI lag on long threads. Threads containing large plan approvals could drop below one frame per second because the plan, user-message, and question boxes re-parsed and re-wrapped their text on every render tick. Their rendered output is now cached until the width or theme changes, keeping long threads responsive (measured: time spent re-wrapping text dropped from 47% of all CPU time to 0.2%).
