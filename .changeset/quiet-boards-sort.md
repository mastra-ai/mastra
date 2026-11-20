---
'@mastra/factory': patch
---

Added Pull request and Trust filters to Factory boards. Pull request keeps the cards that have a pull request (a pull request's own card, or an issue card with one attached) or the ones that don't. Trust keeps the cards from authors with write access, or the ones from outside, using the same check intake rules use. Both combine with the other filters, so you can pick GitHub cards that have a pull request.
