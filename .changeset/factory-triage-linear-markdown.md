---
'@mastra/factory': patch
---

Factory triage comments on Linear issues now render correctly. The triage skill wrote its Linear comments with GitHub-only HTML (the `<!-- mastra-factory-triage -->` marker and a `<details>` block), which Linear shows as literal text. Linear comments now leave out the marker and use Linear's `+++ Details` … `+++` collapsible syntax, and the `linear_create_comment` tool tells agents that Linear does not render HTML.
