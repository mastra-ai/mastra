---
'@mastra/factory': patch
---

Review cards no longer look finished while a review is asking for changes. A review pass now records its verdict on the card and leaves it in Reviewing, where it shows as "Changes requested" or "Approved" with the reviewed commit. Only a merged pull request moves a Review card to Done, and the next push re-reviews it automatically.
