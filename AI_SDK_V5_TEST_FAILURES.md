# AI SDK v5 Migration - Test Failures Investigation & Fix Plan

## Overview

This document tracks all test failures related to the AI SDK v5 migration and our plan to fix them.

## Test Failure Categories

### 1. Core Package Tests (18 failures)

**Location**: `packages/core/src/`

#### A. Agent Tests - Partial Message Rescue (4 failures)

**Files**: `src/agent/agent.test.ts`

- `generate > should rescue partial messages if aborted`
- `stream > should rescue partial messages if aborted`
- `streamVnext > should rescue partial messages if aborted` (2 instances)

**Root Cause**:

- Tests expect partial tool call messages to be saved when generation is aborted
- The `assistantWithToolCall` is undefined, suggesting tool calls aren't being properly captured

**Fix Strategy**:

- Check how partial messages with tool invocations are being saved
- Ensure tool call parts are properly included in saved messages even when stream is aborted

#### B. MessageList Format Issues (7 failures)

**Files**: `src/agent/message-list/message-list.test.ts`, `src/agent/message-list/prompt/convert-to-mastra-v1.test.ts`

**Specific Issues**:

1. MastraMessageV2 messages have unexpected `metadata: {}` field
2. File attachments being converted to 'file' type instead of 'image' type
3. Tool separation not preserving properly in v2 -> ui -> core conversion

**Root Cause**:

- AI SDK v5 changes how attachments are handled (image vs file types)
- MessageList conversion adding unexpected metadata fields
- Tool invocation format changes between SDK versions

**Fix Strategy**:

- Update `attachmentsToParts` function to correctly map image types
- Fix metadata field handling in message conversion
- Update tool invocation preservation logic

#### C. IDGenerator Memory Integration (7 failures)

**Files**: `src/mastra/idgenerator.test.ts`

**Issues**:

- Custom ID generator not working across multiple agents
- Dynamic memory creation with runtime context failing
- Streaming operations with memory persistence broken

**Root Cause**:

- ID generator not being properly passed through runtime context
- Memory instance creation not inheriting custom ID generator

**Fix Strategy**:

- Ensure ID generator is properly propagated through runtime context
- Fix memory instance creation to use custom ID generator
- Update streaming operations to maintain ID generator context

### 2. Memory Tests (1 failure)

**Location**: `packages/memory/src/agent-memory.test.ts`

#### Gemini Tool Input Validation Error

**Issue**: Tool `get_weather` receiving empty object `{}` instead of required `{city: string}`

**Root Cause**:

- Gemini model not properly extracting/providing tool parameters
- Possible AI SDK v5 tool schema handling difference

**Fix Strategy**:

- Investigate how tool schemas are being passed to Gemini
- May need to adjust tool definition format for AI SDK v5 compatibility

### 3. RAG Tests (12 failures)

**Location**: `packages/rag/src/document/document.test.ts`

#### Missing LLM Parameter

**All failures have same error**: "LLM is required for metadata extraction. Please provide an llm parameter."

**Affected Tests**:

- `chunk - metadata title`
- `embed - create embedding from chunk`
- All metadata extraction tests
- All metadata preservation tests

**Root Cause**:

- Breaking change: metadata extractors now require explicit LLM parameter
- Tests not updated to provide LLM when calling extraction methods

**Fix Strategy**:

- Update all test calls to `extractMetadata` to include LLM parameter
- Create mock/test LLM instance for tests
- Ensure backward compatibility where possible

### 4. Combined Store Tests (Multiple failures)

**Location**: Various store packages (cloudflare, libsql, lance, etc.)

#### Message Content Update Issues

**Error**: `expected '' to be 'This is the new content string'`

**Root Cause**:

- `updateMessages` returning empty content strings
- Likely issue with how message content is being updated in v2 format

**Fix Strategy**:

- Investigate `updateMessages` implementation in storage adapters
- Check if content field structure changed in v2 format
- Fix content update logic to properly handle nested content structure

## Implementation Plan

### Phase 1: Critical Message Format Issues (Priority: HIGH)

1. [ ] Fix file attachment type mapping in `convert-to-mastra-v1.ts`
2. [ ] Update `attachmentsToParts` function for AI SDK v5
3. [ ] Fix MessageList V2 conversion metadata issue
4. [ ] Fix tool invocation preservation in message conversion

### Phase 2: RAG Integration (Priority: HIGH)

1. [ ] Add test LLM instance for RAG tests
2. [ ] Update all `extractMetadata` test calls with LLM parameter
3. [ ] Fix MDocument metadata extraction API

### Phase 3: Storage & Memory (Priority: MEDIUM)

1. [ ] Fix message content update in storage adapters
2. [ ] Fix Gemini tool input validation
3. [ ] Investigate semantic search scope issues

### Phase 4: ID Generator Integration (Priority: MEDIUM)

1. [ ] Fix ID generator propagation through runtime context
2. [ ] Update memory instance creation with custom ID generator
3. [ ] Fix streaming operations ID generator context

### Phase 5: Agent Partial Message Rescue (Priority: LOW)

1. [ ] Fix partial tool call message saving on abort
2. [ ] Ensure tool invocations are captured even when incomplete
3. [ ] Update abort handling in generate/stream methods

## Progress Tracking

- [x] Investigation complete
- [ ] Phase 1: Message Format Issues
- [ ] Phase 2: RAG Integration
- [ ] Phase 3: Storage & Memory
- [ ] Phase 4: ID Generator
- [ ] Phase 5: Agent Partial Messages
- [ ] All tests passing
- [ ] CI green

## Notes & Observations

1. Most failures are systematic - fixing root causes will resolve multiple tests
2. Main issue is compatibility between AI SDK v4 and v5 message formats
3. RAG failures are all the same issue - missing LLM parameter
4. Storage failures seem unrelated to AI SDK v5 (message update logic issue)

## Commands for Testing

```bash
# Test individual packages
pnpm --filter @mastra/core test
pnpm --filter @mastra/rag test
pnpm --filter @mastra/memory test

# Test specific files
pnpm --filter @mastra/core test message-list.test.ts
pnpm --filter @mastra/rag test document.test.ts

# Run all tests
pnpm test
```
