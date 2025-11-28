---
'@mastra/playground-ui': patch
'@mastra/ai-sdk': patch
'@mastra/client-js': minor
---

## Unified Streaming API

This PR makes the client-side streaming API consistent across agents, networks, and workflows by introducing dedicated output classes with a unified interface.

### New Output Classes

Three new output classes provide consistent APIs for all streaming operations:

- **`MastraClientModelOutput`** - For agent model streaming (`Agent.stream()`)
- **`MastraClientNetworkOutput`** - For agent network streaming (`Agent.network()`)
- **`MastraClientWorkflowOutput`** - For workflow streaming (all `Workflow.stream*()` methods)

### Method Return Type Changes

**Agent Methods:**
- `Agent.stream()` → Returns `MastraClientModelOutput` (was `Response`)
- `Agent.network()` → Returns `MastraClientNetworkOutput` (was `Response`)

**Workflow Methods (all on Run object returned by `createRun()`):**
- `run.stream()` → Returns `MastraClientWorkflowOutput` (was raw `ReadableStream`)
- `run.observeStream()` → Returns `MastraClientWorkflowOutput` (was raw `ReadableStream`)
- `run.streamVNext()` → Returns `MastraClientWorkflowOutput` (was raw `ReadableStream`)
- `run.observeStreamVNext()` → Returns `MastraClientWorkflowOutput` (was raw `ReadableStream`)
- `run.resumeStreamVNext()` → Returns `MastraClientWorkflowOutput` (was raw `ReadableStream`)

### New Promise-Based Properties

All output classes now provide convenient promise-based properties that automatically consume streams:

**`MastraClientModelOutput`:**
- `text` - Complete text response
- `usage` - Token usage statistics
- `toolCalls` - All tool calls made
- `toolResults` - All tool execution results
- `reasoning` - Reasoning parts array
- `reasoningText` - Complete reasoning text
- `sources` - Source citations
- `files` - Generated files
- `steps` - All step results
- `finishReason` - Why generation finished
- `error` - Error information if available

**`MastraClientNetworkOutput` & `MastraClientWorkflowOutput`:**
- `usage` - Token usage statistics
- `status` - Execution status
- `result` - Complete execution result
- `error` - Error information if available

### Deprecations

- `processDataStream()` method is now deprecated in favor of using `fullStream` directly or accessing promise-based properties
