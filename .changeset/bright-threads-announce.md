---
'@mastra/factory': patch
---

Slack threads that start Factory work now show where the request stands.

- A card filed from a Slack thread puts a reaction on the thread's first message that follows its stage: 👀 triage, 📝 planning, 🔨 building, 🔍 review, ✅ done.
- When a session opens a pull request, its link is posted into the thread, and again when it merges; the merge adds ✅.
- A question answered in the thread gets ✅ once the agent has replied. Threads where the agent never replied, or opened a pull request that has not merged, get no ✅.
