---
'@mastra/factory': patch
---

Surface Factory session state in the browser without switching to the window. The favicon on session tabs is color-coded by lifecycle state (amber initializing, green working, blue awaiting user input, red errored). Sidebar dots now cover all sessions — workspaces and user sessions alike — with tooltip labels (Initializing / Working / Ready), reusing the same three colors so a tab and its sidebar row read the same at a glance; errors are shown on the favicon only. Browser tab titles show the session's canonical identifier (`#1567` for GitHub PRs and issues, `COR-210` for Linear) or the thread title for user sessions, so a wall of session tabs is easy to identify. Board kickoff toasts also gain a secondary **New Tab** action so a ready session can be opened without leaving the review or work board.
