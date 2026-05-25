---
'@mastra/core': patch
---

Fixed a race condition where an immediate auto-resume of a suspended tool call would fail with `This workflow run was not suspended` against slower storage backends like `PostgresStore`. The suspend-side snapshot write can lag behind the `tool-call-suspended` event that triggers a resume, so the resume now briefly polls until the suspended snapshot is visible. The happy path adds no latency; only the racing path retries.

Fixes [#16158](https://github.com/mastra-ai/mastra/issues/16158).
