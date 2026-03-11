---
'@mastra/core': patch
---

Fixed agent loop not stopping for client tools without an execute function. When a tool created with createTool() has no execute function (intended for client-side execution), the agent's do-while loop would incorrectly continue calling the model repeatedly. The loop now properly detects that client tools without execute should stop the loop and return control to the caller. Fixes #14093
