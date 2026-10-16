---
'@mastra/core': patch
---

Fixed automatic conversation titles for Slack and other channels. Threads still showing the generic channel label, such as `slack conversation`, are named on their next successful turn. Custom and pinned titles are kept.

Automatic title generation also no longer overwrites a title set while the title model was running, and never names a thread whose title is pinned, even when that title is empty.
