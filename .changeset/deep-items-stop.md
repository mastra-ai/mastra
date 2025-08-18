---
'@mastra/core': patch
---

Reworks agent Processor API to include output processors. Adds structuredOutput property in agent.streamVNext and agent.generate to replace experimental_output. Move imports for processors to @mastra/core/processors. Adds 6 new output processors, BatchParts, StructuredOutputProcessor, TokenLimiter, SystemPromptScrubber, ModerationProcessor, PiiDetectorProcessor.
