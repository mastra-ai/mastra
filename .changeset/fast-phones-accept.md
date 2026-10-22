---
'@mastra/factory': minor
---

Factory cards now link to their issue and to every pull request opened for them. When Factory opens a pull request, the link lands on the card that did the work, and review verdicts and merge/close state are recorded on that link. Stored boards' event routes decide where pull request and issue events move a card; a deployment's own rule overrides still win.
