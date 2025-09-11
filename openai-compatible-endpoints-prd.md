# OpenAI-Compatible Endpoints Feature PRD

**Created**: 2025-01-08
**Updated**: 2025-01-09
**Status**: In Development

## Overview

Adding support for OpenAI-compatible API endpoints to Mastra's new agentic loop (`streamVNext`/`generateVNext`), reducing reliance on Vercel AI SDK while maintaining compatibility with existing AI SDK provider packages.

## Problem Statement

- Currently requires installing AI SDK provider packages (`@ai-sdk/openai`, etc.)
- No direct way to connect to OpenAI-compatible endpoints
- Future goal: Remove dependency on AI SDK entirely for basic LLM operations

## Goals

1. Enable direct connection to OpenAI-compatible endpoints without additional packages
2. Maintain backward compatibility with existing AI SDK provider usage
3. Support authentication via headers

## User Experience

### API Design

#### Pattern 1: Provider/Model String (Magic String)

```typescript
const agent = new Agent({
  model: 'openai/gpt-4o', // provider/model format
  // ...
});

// Also supports:
const agent = new Agent({
  model: 'anthropic/claude-3-5-sonnet-latest',
  model: 'google/gemini-2.0-flash-thinking-exp',
  model: 'deepseek/deepseek-reasoner',
  // etc.
});
```

#### Pattern 2: Extended Configuration

```typescript
const agent = new Agent({
  model: {
    url: 'https://api.example.com/v1/chat/completions',
    modelId: 'gpt-4o', // Required: specifies which model to use
    apiKey: 'sk-xxx', // Required: authentication
    headers: {
      // Optional: additional headers
      'X-Custom-Header': 'value',
    },
    // Optional future fields:
    // maxRetries?: number,
    // timeout?: number,
  },
  // ...
});
```

Note: Simple URL strings are NOT supported as you always need to specify both a model ID and API key.

## Technical Architecture

### Components

1. **OpenAICompatibleModel** (✅ implemented)
   - Implements `LanguageModelV2` interface
   - Handles HTTP communication with OpenAI-compatible endpoints
   - Manages streaming responses with proper delta handling
   - Supports Anthropic-specific headers when needed
   - Based on AI SDK's openai-compatible implementation pattern

2. **Gateway Architecture** (✅ implemented)
   - **MastraModelGateway** - Abstract base class for provider gateways
   - **ModelsDevGateway** - Fetches provider configurations from models.dev API
   - **NetlifyGateway** - Fetches provider configurations from Netlify's registry
   - Gateways provide URL resolution and provider metadata

3. **Provider Registry** (✅ implemented)
   - Generated from models.dev API via TypeScript script
   - Contains all provider configurations and model IDs
   - Type-safe OpenAICompatibleModelId union type
   - Auto-completion support for all available models

4. **Model Resolution** (✅ updated)
   - Detects provider/model string format
   - Creates `OpenAICompatibleModel` instance with gateway resolution
   - Supports extended configuration objects
   - Pass through to existing flow for AI SDK models

5. **Integration Points**
   - `packages/core/src/agent/index.ts` - Model resolution logic
   - `packages/core/src/llm/model/openai-compatible.ts` - OpenAICompatibleModel class
   - `packages/core/src/llm/model/gateways/` - Gateway implementations
   - `packages/core/src/llm/model/provider-registry.generated.ts` - Generated provider data
   - `packages/core/scripts/generate-providers.ts` - Provider generation script
   - `packages/core/src/agent/types.ts` - Updated type definitions

### Data Flow

```
Agent Configuration
    ↓
Model Resolution (getModel)
    ↓
Provider/Model string? → Gateway lookup → Create OpenAICompatibleModel
    ↓
Extended config? → Create OpenAICompatibleModel directly
    ↓
MastraLLMVNext wrapper
    ↓
Loop (agentic execution)
    ↓
HTTP calls to endpoint (with proper streaming deltas)
```

## Implementation Plan

### Phase 1: Core Implementation ✅

- [x] Create `OpenAICompatibleModel` class
- [x] Implement basic chat completions
- [x] Add streaming support with proper delta handling
- [x] Update Agent model types
- [x] Add model resolution logic
- [x] Fix streaming to send delta text instead of accumulated text
- [x] Fix message content property names (data, input, output)
- [x] Add Anthropic header support

### Phase 2: Gateway Architecture ✅

- [x] Create base MastraModelGateway abstract class
- [x] Implement ModelsDevGateway class
- [x] Implement NetlifyGateway class
- [x] Convert generate-providers.mjs to TypeScript
- [x] Update OpenAICompatibleModel to use gateways for URL resolution
- [x] Generate provider registry from models.dev API
- [x] Build and verify no TypeScript errors

### Phase 3: Testing & Refinement 🚧

- [x] Create basic test examples
- [ ] Verify extended configuration pattern support
- [ ] Write integration tests for ModelsDevGateway
- [ ] Write integration tests for NetlifyGateway
- [ ] Test streaming with real API calls
- [ ] Test tool calling functionality
- [ ] Add comprehensive error handling and retries
- [ ] Create documentation for OpenAI-compatible endpoints

## Implementation Details

### Files Created/Modified

1. **`packages/core/src/llm/model/openai-compatible.ts`** - OpenAICompatibleModel class with streaming fixes
2. **`packages/core/src/llm/model/gateways/base.ts`** - MastraModelGateway abstract class
3. **`packages/core/src/llm/model/gateways/models-dev.ts`** - ModelsDevGateway implementation
4. **`packages/core/src/llm/model/gateways/netlify.ts`** - NetlifyGateway implementation
5. **`packages/core/src/llm/model/provider-registry.generated.ts`** - Generated provider configurations
6. **`packages/core/scripts/generate-providers.ts`** - TypeScript provider generation script
7. **`packages/core/src/llm/model/shared.types.ts`** - Added MastraModelConfig and OpenAICompatibleConfig types
8. **`packages/core/src/agent/types.ts`** - Updated to use MastraModelConfig
9. **`packages/core/src/agent/index.ts`** - Added model resolution logic
10. **`packages/core/src/llm/index.ts`** - Exported new types and model

### Current Status

- Core implementation complete with streaming fixes
- Gateway architecture implemented and working
- Provider registry generated from models.dev
- TypeScript compilation successful
- Build passes without errors
- Ready for integration testing

### Phase 4: Future Enhancements

- [ ] Anthropic-compatible endpoints
- [ ] Auto-detection of endpoint format
- [ ] Advanced configuration options

## Success Metrics

- Users can connect to OpenAI-compatible endpoints without installing provider packages
- Existing AI SDK provider usage continues to work
- Performance is comparable to direct AI SDK usage

## Risks & Mitigation

- **Risk**: Breaking existing functionality
  - **Mitigation**: Comprehensive testing, gradual rollout
- **Risk**: Incompatible endpoint variations
  - **Mitigation**: Start with standard OpenAI format, expand based on user needs

## Open Questions

- ✅ Should we auto-detect provider from URL patterns? → No, not initially
- ✅ How to handle model-specific features (e.g., o1 reasoning tokens)? → Use schema compat layers
- Should we support non-OpenAI formats initially? → No, focus on OpenAI-compatible first
