---
'@mastra/core': patch
---

Fix model-level and runtime header support for LLM calls

This fixes a bug where custom headers configured on models (like `anthropic-beta`) were not being passed through to the underlying AI SDK calls. The fix properly handles headers from multiple sources with correct priority:

**Header Priority (low to high):**
1. Model config headers - Headers set in model configuration
2. ModelSettings headers - Runtime headers that override model config
3. Provider-level headers - Headers baked into AI SDK providers (not overridden)

**Examples that now work:**
```typescript
// Model config headers
new Agent({
  model: {
    id: 'anthropic/claude-4-5-sonnet',
    headers: { 'anthropic-beta': 'context-1m-2025-08-07' }
  }
})

// Runtime headers override config
agent.generate('...', {
  modelSettings: { headers: { 'x-custom': 'runtime-value' } }
})

// Provider-level headers preserved
const openai = createOpenAI({ headers: { 'openai-organization': 'org-123' } });
new Agent({ model: openai('gpt-4o-mini') })
```
