# OpenAI-Compatible Endpoints Feature PRD

**Created**: 2025-01-08
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

#### Pattern 1: Simple URL

```typescript
const agent = new Agent({
  model: 'https://api.example.com/v1/chat/completions',
  // ...
});
```

#### Pattern 2: Extended Configuration

```typescript
const agent = new Agent({
  model: {
    url: 'https://api.example.com/v1/chat/completions',
    headers: {
      Authorization: 'Bearer sk-xxx',
      'X-Custom-Header': 'value',
    },
    // Optional future fields:
    // modelId?: string,  // for telemetry/logging
    // maxRetries?: number,
    // timeout?: number,
  },
  // ...
});
```

Both patterns will be supported from the initial implementation.

## Technical Architecture

### Components

1. **OpenAICompatibleModel** (new)
   - Implements `LanguageModelV2` interface
   - Handles HTTP communication with OpenAI-compatible endpoints
   - Manages streaming responses
   - Based on AI SDK's openai-compatible implementation pattern

2. **Model Resolution** (updated)
   - Update `Agent.getModel()` to detect URL-based configurations
   - Create `OpenAICompatibleModel` instance when URL is provided
   - Pass through to existing flow for AI SDK models

3. **Integration Points**
   - `packages/core/src/agent/index.ts` - Model resolution logic
   - `packages/core/src/llm/model/` - New OpenAICompatibleModel class
   - `packages/core/src/agent/types.ts` - Updated type definitions

### Data Flow

```
Agent Configuration
    ↓
Model Resolution (getModel)
    ↓
URL detected? → Create OpenAICompatibleModel
    ↓
MastraLLMVNext wrapper
    ↓
Loop (agentic execution)
    ↓
HTTP calls to endpoint
```

## Implementation Plan

### Phase 1: Core Implementation ✅

- [x] Create `OpenAICompatibleModel` class
- [x] Implement basic chat completions
- [x] Add streaming support
- [x] Update Agent model types
- [x] Add model resolution logic

### Phase 2: Testing & Refinement

- [x] Create basic test examples
- [ ] Fix build/import issues
- [ ] Test with various OpenAI-compatible endpoints
- [ ] Add error handling and retries
- [ ] Documentation

## Implementation Details

### Files Created/Modified

1. **`packages/core/src/llm/model/openai-compatible.ts`** - New OpenAICompatibleModel class
2. **`packages/core/src/llm/model/shared.types.ts`** - Added MastraModelConfig and OpenAICompatibleConfig types
3. **`packages/core/src/agent/types.ts`** - Updated to use MastraModelConfig
4. **`packages/core/src/agent/index.ts`** - Added model resolution logic
5. **`packages/core/src/llm/index.ts`** - Exported new types and model

### Current Status

- Core implementation complete
- TypeScript compilation successful
- Runtime testing blocked by module import issues (investigating)

### Phase 3: Future Enhancements

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
