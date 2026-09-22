---
'@mastra/playground-ui': patch
---

Page status states now own their centering. `SessionExpired`, `PermissionDenied` and `ErrorState` accept `variant="fill"`, and `Spinner` accepts `fill` plus a new `size="lg"`, so call sites no longer hand-roll a `flex h-full items-center justify-center` wrapper around them. `ErrorState` is rebuilt on `EmptyState` and drops its fixed `h-[30vh]` height, which used to push the block above center inside a full-height parent.
