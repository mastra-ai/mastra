---
'@mastra/factory': patch
---

Fixed a materialize storm where a session would loop retrying `git checkout -b` when the target branch already existed locally (surfacing as `fatal: a branch named 'factory/pr-XXXX' already exists`). The initial `show-ref` probe can miss branches that live only in `packed-refs` or that a prior partially-completed checkout left behind; when that happens, checkout now falls back to switching to the existing branch instead of throwing, so other sessions sharing the workspace are no longer starved.
