---
'@mastra/core': patch
---

Fixed background workflow tools filling Redis with oversized progress updates (#25590). When a background workflow step called an agent, each progress update carried a full copy of the model request and message history, so a single update could reach 60MB. Progress updates now leave those copies out and no longer repeat the task's arguments, while progress information such as text, finish reason, and usage is still delivered.
