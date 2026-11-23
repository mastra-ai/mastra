---
'@mastra/core': patch
---

Fixed memory growth from workflow runs that suspend and are never resumed (default and evented engines). Once a run's suspension is saved to storage and nothing in the process is watching it, the workflow stops holding it. While your code still holds the run, `createRun({ runId })` returns that same run, so watchers and `cancel()` keep working across handles; once nothing holds it, `createRun({ runId })` rebuilds it from the saved snapshot, in the same process or a new one, and keeps the stored `resourceId` when you pass none.
 On runtimes without `WeakRef` or `FinalizationRegistry` (such as Cloudflare Workers with a compatibility date before 2025-05-05), suspended runs stay held as before.