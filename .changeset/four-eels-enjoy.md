---
'@mastra/server': patch
---

Added POST /stored/agents/preview-instructions endpoint for resolving instruction blocks against a request context. This enables UI previews of how agent instructions will render with specific variables and rule conditions. Updated Zod schemas to support the new AgentInstructionBlock union type (text, prompt_block_ref, inline prompt_block) in agent version and stored agent responses.
