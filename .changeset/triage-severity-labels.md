---
'@mastra/factory': patch
---

Factory triage now labels GitHub issues with the severity from its handoff (`severity:critical`, `severity:high`, `severity:medium` or `severity:low`), alongside the existing effort and impact labels. Each issue keeps exactly one severity label, and a refresh replaces it when the severity changes. The handoff table now shows severity as plain text (`high`) instead of with a colored emoji.
