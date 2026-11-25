---
'@mastra/core': patch
---

Fixed background tool calls from a durable agent never running when the process has no background-task worker (`workers: false`, or `MASTRA_WORKERS` without `backgroundTasks`), for example an API server in front of dedicated workers. The task stayed `pending` forever and the agent answered without the tool's result. The tool now runs inline in that run, and a regular agent gets the dispatch error as the tool result instead of a task that never runs. Fixes #31089.
