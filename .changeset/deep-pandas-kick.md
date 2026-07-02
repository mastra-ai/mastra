---
'@mastra/core': patch
---

Fixed SystemPromptScrubber `processOutputStream` swallowing TripWire errors when strategy is `block`. The abort call now correctly propagates the TripWire to halt the agent stream, matching the existing behavior in `processOutputResult`.
