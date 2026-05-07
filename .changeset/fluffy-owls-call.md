---
'@mastra/core': patch
'mastracode': minor
---

Added `/goal` to Mastra Code, a persistent autonomous task loop similar to the goal modes in Codex and Hermes Agent.

A user can start a goal with `/goal <objective>`. Mastra Code saves that objective to the current thread, runs the normal assistant turn, then asks a separate judge model whether the goal is `done`, should `continue`, or is `waiting` on an explicit user checkpoint. When the judge says to continue, Mastra Code feeds the judge feedback back into the conversation and keeps working until the goal is complete, paused, cleared, or reaches the configured attempt limit.

Use `/judge` to configure the default judge model and max attempts used by future goals.

Approved plans can be selected as a goal from the inline plan approval UI, slash commands can opt into `/goal/<command>` with top-level `goal: true`, and skills can opt into goal commands with `metadata.goal: true`. `/goal` objectives can also span multiple lines.
