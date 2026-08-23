---
'@mastra/factory': patch
---

Fixed merged pull requests only reaching one of the two Factory cards that track them. A merge now both moves the Review card to Done and asks the work item that opened the pull request to assess whether its work is finished, no matter which card the merge event resolved to.
