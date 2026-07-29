---
'@mastra/factory': patch
---

Fixed Factory rules treating a work item from a non-GitHub, non-Linear source as a GitHub issue. A Slack thread card moved into Triage ran the GitHub issue rule and handed the triage agent a Slack permalink labeled as a GitHub issue; those cards now resolve the plain work-item rules instead.
