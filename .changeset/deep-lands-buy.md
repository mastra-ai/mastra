---
'@mastra/core': patch
---

Fixed the `skill` and `skill_read` tools silently succeeding when the requested skill does not exist. They now throw a `SkillNotFoundError`, so the failure shows up as a tool error in Studio and traces instead of a normal-looking result the agent can easily miss. The error still lists the available skills so the agent can retry with a valid name or path.
