---
'@mastra/core': patch
---

Let `onDelegationComplete` correct a delegation result within the current run

A subagent that stops on a tool-calls step returns empty text, which the parent model
reads as a successful but empty delegation and narrates around ("I'll report back once
it returns"). The `feedback` returned from `onDelegationComplete` is persisted to the
parent's memory, so it only reaches the model on the next turn — after the parent has
already answered.

The hook can now return `resultText`, which replaces the tool result text the parent
model sees for that delegation in the run that is still executing.
