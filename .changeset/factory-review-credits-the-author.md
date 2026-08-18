---
'@mastra/factory': patch
---

Credit the author on review follow-up pull requests

When a review pass ships mechanical fixes as a follow-up pull request, those
commits now carry a `Co-Authored-By` trailer for the human whose work they build
on — the reviewed pull request's author, or, when that author is a bot, the
reporter of the issue the pull request closes.
