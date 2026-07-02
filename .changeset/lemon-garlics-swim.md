---
'@mastra/core': minor
'@mastra/deployer': minor
---

File-based agents can now nest subagents up to three levels deep. A subagent directory can declare its own `subagents/`, and each level is assembled and wired into its parent as a delegation tool. Levels deeper than the cap are ignored with a warning.

```text
src/mastra/agents/
  supervisor/            # depth 0
    subagents/
      researcher/        # depth 1
        subagents/
          summarizer/    # depth 2
```
