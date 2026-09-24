---
'@mastra/quickjs': patch
---

Fixed guest code being able to crash the host Node process. Running out of memory while `external_*` calls are in flight now returns an "out of memory" error instead of aborting, and deep recursion now returns a "stack overflow" error instead of killing Node on arm64. The default `maxStackSizeBytes` is now 256 KiB (was 1 MiB).
