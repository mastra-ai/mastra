---
'@mastra/core': patch
'mastracode': minor
---

Added `/goal` to Mastra Code, a persistent autonomous task loop similar to the goal modes in Codex and Hermes-style coding agents.

A user can start a goal with `/goal <objective>`. Mastra Code saves that objective to the current thread, runs the normal assistant turn, then asks a separate judge model whether the goal is `done`, should `continue`, or is `waiting` on an explicit user checkpoint. When the judge says to continue, Mastra Code feeds the judge feedback back into the conversation as a system reminder and keeps working until the goal is complete, paused, cleared, or reaches the configured attempt limit. Goals survive thread switches and restarts, show progress in the status line, and lock input while the judge is evaluating so follow-ups, pauses, and queued actions are handled safely.

Added `/judge` to configure the default judge model and max attempts used by future goals. Goal setup metadata and terminal judge results are persisted as system reminders so resumed threads keep their goal context.

Added more ways to create goals: approved plans can be selected as a goal from the inline plan approval UI, slash commands can opt into `/goal/<command>` with top-level `goal: true`, and skills can opt into goal commands with `metadata.goal: true`. `/goal` objectives can also span multiple lines.

The Harness system-reminder message shape now preserves goal metadata used by Mastra Code goal reminders.
