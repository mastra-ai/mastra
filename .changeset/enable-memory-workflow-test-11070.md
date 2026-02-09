---
"@mastra/core": patch
---

Enable memory workflow test and improve MockMemory ID handling. The previously skipped test "should handle complex workflow with memory operations" is now enabled to verify memory workflow functionality. MockMemory now automatically assigns unique IDs to messages that don't have one, ensuring consistent storage behavior.
