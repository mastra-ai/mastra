---
'@mastra/core': patch
---

Fixed goal reliability issues: agents no longer lose their goal context when multiple goal-configured agents share one Mastra instance, a failing or timed-out goal judge now retries (without consuming run budget) and only pauses the goal after 3 consecutive failures, and goal retractions now include a reason (cleared, done, paused, or absent) for easier debugging.
