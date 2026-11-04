---
'@mastra/factory': minor
---

Factory pages load faster. The project list now returns each project's linked repositories, so the web UI makes one request before it renders instead of one more per project, and the repositories are read in a fixed handful of database queries however many projects there are.

```ts
const { projects } = await (await fetch('/web/factory/projects')).json();

projects[0].repositories;
// [{ projectRepositoryId, connectionId, integrationId, repositoryId, externalId, slug, defaultBranch, branch, sandboxWorkdir }]
```

The list includes no installation details. `GET /web/factory/projects/:id/source-control-connections` returns the same response as before, using the same faster read.
