---
'mastra': patch
---

Fixed `mastra build` silently deleting a running `mastra dev` server's files.

`mastra build` and `mastra dev` share the same output directory (`.mastra`). Running a build while a dev server was still up would empty that directory out from under it — including the dev server's own state and the studio UI it had already served — with no warning. The dev server kept running afterward, but any request that depended on those files would then fail.

`mastra build` now checks whether a dev server is running in the same directory before it starts, and stops with a clear message instead of deleting its files:

```text
✗ A `mastra dev` server is running in this directory

│ PID 12345 is still active (localhost:4111).
│ Building now would empty its output directory out from under it.

To fix this:
• Stop the dev server (PID 12345), or
• Re-run with --force to build anyway.
```

Pass `--force` to build anyway (for example in a script that manages the dev server's lifecycle itself):

```bash
mastra build --force
```
