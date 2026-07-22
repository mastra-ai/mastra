---
'@mastra/code-sdk': major
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Replaced GitHub-specific Mastra Code session state with Factory project and linked-repository identities. This lets SDK consumers represent sessions independently of a source-control provider and select a repository explicitly when sandbox execution is required.

Updated Mastra Code onboarding to be Factory-first: create a Factory by name, then link repositories from your connected source-control installations in a separate step. A Factory is valid with zero linked repositories, and the Board, Metrics, and Audit pages stay available for any server-backed Factory. Factory pages keep project-scoped data separate from repository-scoped intake and provide a repository selector when a Factory has multiple linked repositories. Creating a Factory from a local folder remains available as a secondary option.

**Before**

```ts
const state = { githubProjectId: 'project-1', sandboxId, sandboxWorkdir };
```

**After**

```ts
const state = {
  factoryProjectId: 'factory-project-1',
  projectRepositoryId: 'project-repository-1',
  sandboxId,
  sandboxWorkdir,
};
```
