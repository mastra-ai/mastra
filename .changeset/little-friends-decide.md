---
'@mastra/core': patch
---

Fixed workspace `requireReadBeforeWrite` falsely rejecting writes after suspend/resume and between conversation turns (#23772). Read records are now tracked per memory thread instead of per run, so a file read before a tool suspends (for example, awaiting plan approval) no longer needs a wasteful re-read after the run resumes. Files modified on disk after being read still require a re-read before writing.

**Custom read trackers** — for serverless runtimes where in-memory state does not survive between suspend and resume, a persistent `FileReadTracker` (methods may now return promises) can be injected through the workspace tools config:

```ts
const workspace = new Workspace({
  tools: {
    readTracker: myStorageBackedTracker,
  },
});
```
