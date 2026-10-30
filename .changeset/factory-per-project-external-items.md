---
'@mastra/factory': minor
---

The same Jira, Linear or incident.io item can now be filed in more than one Factory project. Before, the first project to file an item held it for the whole org, and other projects that ingested it got no card. Each project now keeps its own card. Within a project the card is still reused when the item is seen again, after the card finishes and when the issue reopens. A Linear card is also found after the issue's identifier changes, for example when the issue moves to another team.

**Breaking changes**

- `claimKey` is removed from the `upsertLinkedWorkItem` decision type. Rules that still return it, and decisions saved before this release, keep working: the field is accepted and ignored.
- `WorkItemClaimConflictError`, `getByClaimKey`, `claimWorkItem`, `releaseProjectClaims` and `WorkItemRow.claimKey` are removed.

The `claim_key` column stays in the database. Values already stored there are left in place and no longer affect anything.
