---
'@mastra/factory': patch
---

Fixed runs failing with "Factory source-control repository not found." after a repository's source-control connection was reinstalled. When a card's repository is linked but turned off in the Factory's environment, the error now names the repository and says to turn it on under Settings → Environment.
