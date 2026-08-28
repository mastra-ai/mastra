---
'@mastra/factory': minor
---

Agent runs now read the work item's recent discussion at kickoff. The last 20 comments ride the kickoff message, so a teammate's context reaches the agent without anyone copy-pasting it into a prompt.

The block is bounded to 20 comments and a 12,000 character budget, and it is framed as untrusted data: comment bodies, author names and quotes are escaped so a comment cannot forge the block's boundaries.
