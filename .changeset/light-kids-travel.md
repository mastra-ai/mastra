---
'@mastra/core': patch
'mastracode': patch
---

Fixed unbounded shell output retention in the controller display state and the Mastra Code terminal UI. Live shell output now keeps the latest 1 MB per command.

`execute_command` no longer rewrites a trailing `| tail -N`; the pipeline runs as written. Pipelines that end in `tail` now run with `pipefail` where the shell supports it, so a failing upstream command reports its non-zero exit code instead of `tail`'s success. The `tail` option still limits output returned to the model.
