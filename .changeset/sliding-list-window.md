---
'@mastra/playground-ui': patch
---

Fixed live updates in the Spans and Threads lists stopping after the tab stays open for a while. Each poll now asks for a window of the same length ending now, instead of stretching the original window, so a server cap on the window length (such as the 7-day limit on word search) no longer refuses the poll.
