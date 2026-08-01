---
'mastracode': patch
---

Fixed severe TUI lag on long threads. Threads containing large plan approvals could drop below one frame per second because the plan, user-message, and question boxes re-parsed and re-wrapped their text on every render tick. Their rendered output is now cached until the width or theme changes, keeping long threads responsive (measured: process CPU under render load dropped from ~100% to under 20%).
