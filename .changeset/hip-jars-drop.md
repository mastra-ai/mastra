---
'@mastra/factory': minor
---

Added label filters to Jira intake routing, so one Jira project can feed several factories. Each factory's binding takes either all issues or only issues carrying its labels. Label filters take precedence over the all-issues binding; an issue carrying labels from two filters goes to the binding created first. Each issue is filed in exactly one factory.

```http
PUT /web/intake/bindings
{ "integrationId": "jira", "sourceId": "10000", "factoryProjectId": "<payments factory>", "board": "work", "labels": ["payments"] }

DELETE /web/intake/bindings?integrationId=jira&sourceId=10000&factoryProjectId=<payments factory>
```

Overlapping labels, or a second all-issues binding, are rejected with `409 binding_conflict`. Labels decide placement only when an issue is first filed; relabelling an issue does not move its card. Linear, GitHub, GitLab and incident.io bindings are unchanged: a source still feeds one factory.

**Upgrading:** existing bindings move to new storage on first start and keep taking all issues, so nothing changes until you add a label filter. If you roll back to an earlier version, bindings return to how they were when you upgraded; changes made since, including label filters, are not carried back.
