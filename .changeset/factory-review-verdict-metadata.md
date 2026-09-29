---
'@mastra/factory': patch
---

Fixed Factory cards looking finished while a review is still asking for changes.

- **Review cards:** a review pass now records its verdict on the card and leaves it in Reviewing. The card shows "Changes requested" or "Approved" with the reviewed commit. A merged pull request moves a Review card to Done, a pull request closed without merging moves it to Canceled, and the next push starts a re-review automatically.
- **Work cards:** a Work card now moves from Building to Review when its pull request opens, shows the review verdict there, and moves to Done when the pull request merges. Agents can't move a Work card to Done while its pull request is still open or while the review requests changes.
