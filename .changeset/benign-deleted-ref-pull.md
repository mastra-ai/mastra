---
'@mastra/factory': patch
---

Fixed workspace re-open hard-failing when a session branch was auto-deleted after merge. `git pull` messages like "no such ref was fetched" and "couldn't find remote ref" are now treated as benign, so materialization keeps the checkout as-is instead of leaving permanent rule-effect alerts on Done items.
