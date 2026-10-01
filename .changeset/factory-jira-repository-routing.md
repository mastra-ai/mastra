---
'@mastra/factory': minor
---

Added Jira project → repository routing so one Jira project can feed a Factory that links several repositories.

Settings › Intake › Jira routing now lets you pick a default repository for each routed Jira project and map individual Jira components to repositories. When a run starts on a Jira card, Factory uses the repository of the first routed component, then the project default, before falling back to asking for a repository. Automated runs on multi-repository Factories no longer stall on "Choose a repository for this work item" once a mapping exists.

Jira cards now carry `jiraSourceId` and `components` in their metadata; existing cards pick these up on the next reconciliation pass.
