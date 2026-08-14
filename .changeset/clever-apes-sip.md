---
'@mastra/factory': patch
---

Added Factory session state to browser tabs and the sidebar, so a running session can be followed without switching to its window.

- Session tab favicons are color-coded: amber while initializing, green while the agent works, blue when it is your turn, red on failure.
- Sidebar status dots now cover workspaces and user sessions alike, with Initializing / Working / Ready tooltips in the same three colors, so a tab and its sidebar row read the same.
- Failures show on the favicon only; the sidebar has no error dot yet.
- Tab titles show the session's identifier — `#1567` for GitHub pull requests and issues, `COR-210` for Linear — or the thread title for user sessions.
- Board kickoff toasts gained a **New Tab** action, so a ready session opens without leaving the board.
