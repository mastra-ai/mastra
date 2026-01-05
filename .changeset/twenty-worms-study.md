---
'@mastra/client-js': patch
---

Add `cancel()` method as an alias for `cancelRun()` in the Run class. The new method provides a more concise API while maintaining backward compatibility. Includes comprehensive documentation about abort signals and how steps can respond to cancellation.
