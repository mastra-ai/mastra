---
'@mastra/core': patch
---

Fix reasoning content being lost when text-start chunk arrives before reasoning-end

Some model providers (e.g., ZAI/glm-4.6) return streaming chunks where `text-start` arrives before `reasoning-end`. Previously, this would clear the accumulated reasoning deltas, resulting in empty reasoning content in the final message. Now `text-start` is properly excluded from triggering the reasoning state reset, allowing `reasoning-end` to correctly save the reasoning content.
