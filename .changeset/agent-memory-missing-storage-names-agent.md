---
'@mastra/core': patch
---

Name the agent in the missing-storage error thrown by `Memory`. When an agent's memory never received storage because the agent was never attached to a Mastra instance, accessing `memory.storage` now fails with `[Agent:<name>] Memory requires a storage provider to function. ...`, so it is clear which agent is misconfigured. The registration and standalone-storage guidance added in #29972 is unchanged, and agents that inherit storage from their Mastra or configure it directly on `Memory` are unaffected.
