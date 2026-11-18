---
'mastra': patch
---

GitHub avatars on Factory cards and in the board's people filter now load from GitHub's avatar image host instead of github.com. Before, every avatar was a separate, uncached request to github.com, so a large board could push GitHub to rate-limit your IP and block your own github.com pages for a while.
