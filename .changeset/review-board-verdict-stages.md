---
'@mastra/factory': patch
---

Review cards now land in **Changes requested** or **Approved** after a review, instead of **Done**. A card asking for changes no longer looks finished on the board, and a push to the PR re-reviews it from either lane. **Done** now means the pull request merged; a review run can no longer close the card itself. Cards already sitting in Done on an open PR move to the new lanes on their next push.
