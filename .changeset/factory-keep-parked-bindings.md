---
'@mastra/factory': patch
---

Fixed Factory runs losing their link to the card after 24 hours of waiting on a person. Before, a run that asked a question with `ask_user` or `submit_plan` lost this link after a day. When someone answered, the run could no longer update the card, react to card rules, or act as the card's reviewer.

Now the link is kept while the run is still waiting for an answer or still working. The link is still removed when the run is gone, or when the card is finished, missing, or moved.
