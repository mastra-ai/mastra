---
'@mastra/factory': patch
---

Added Pull request and Trust filters to Factory boards. Pull request keeps the cards that have a pull request (a pull request's own card, an issue card with one attached, or an issue card that another card's pull request resolves) or the ones that don't. Trust keeps the cards from authors with write access, or the ones from outside, using the same check intake rules use: a GitHub or GitLab card whose author has no trust stamp counts as from outside, and cards from sources no outsider can file, such as Linear and manual cards, count as trusted. Both combine with the other filters, so you can pick GitHub cards that have a pull request:

```
GET /web/factory/projects/:projectId/boards/work/phases?source=github&pullRequest=with&trust=untrusted
```

A pull request that fixes several issues is still held by the first issue's card, and the other issues' cards now link to it: searching the pull request's number or link finds them, they count as having a pull request, and they show the holding card as related.
