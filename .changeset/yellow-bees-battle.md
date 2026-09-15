---
'@mastra/core': minor
---

Added a `fileReadTracker` option to `Workspace` so read-before-write records can survive suspend/resume.

By default, `requireReadBeforeWrite` tracking lived only in memory for a single run. When a run suspended between reading and writing a file (for example plan approval, `requireApproval` tools, or `askUserTool`), the tracker was discarded and recreated empty on resume, so the next `write_file`/`edit_file` was wrongly rejected with "has not been read" — most visibly on serverless or container runtimes that tear the process down while waiting for a human.

You can now pass a custom tracker (an instance, or a factory that receives `{ threadId, resourceId, runId, requestContext }`) to persist read records per thread so the policy stays consistent across suspend/resume:

```typescript
const trackers = new Map<string, FileReadTracker>();

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  tools: { mastra_workspace_edit_file: { requireReadBeforeWrite: true } },
  fileReadTracker: ({ threadId }) => {
    const key = threadId ?? 'default';
    let tracker = trackers.get(key);
    if (!tracker) trackers.set(key, (tracker = new InMemoryFileReadTracker()));
    return tracker;
  },
});
```

The default behavior is unchanged, and tracker methods may now be async so implementations can be backed by storage.
