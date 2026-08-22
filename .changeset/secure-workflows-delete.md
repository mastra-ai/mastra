---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
'@mastra/spanner': patch
'@mastra/code-sdk': patch
---

Added owner-qualified dynamic workflow deletion and same-owner validation for dynamic nested workflows.

`Mastra.deleteDynamicWorkflow()` serializes deletion with registration, removes storage before the live dynamic workflow, and never unregisters a code-defined workflow. Storage adapters atomically include a supplied author in the delete predicate. Trusted dynamic workflow registration rejects nested dynamic workflows owned by another author or lacking ownership metadata before changing the live registry.

```ts
const deleted = await mastra.deleteDynamicWorkflow('campaign-assets', {
  authorId: authenticatedUser.id,
});
```

Owned rows now require their immutable `authorId` on every update, so omitting ownership cannot bypass an adapter's atomic owner predicate. Unscoped deletion still removes a live-only dynamic registration when no stored row exists.

Authenticated server deletion now derives ownership from request context. Missing and cross-owner definitions return the same response, admins delete using the stored immutable owner, and legacy unowned definitions remain mutation-quarantined.

Mastra Code deletion now delegates storage and live-registry cleanup to `Mastra.deleteDynamicWorkflow()` instead of maintaining a second deletion sequence. Its local tool remains a privileged, unscoped surface; this change does not add caller ownership to Mastra Code.

Workflow execution and control routes are not owner-scoped by this change.
