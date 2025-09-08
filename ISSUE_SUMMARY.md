# Issue #7558: Support for providerExecuted tools in custom models

## Problem Summary

When using custom model connectors (like Claude Code SDK with Vercel AI SDK v5) that have tools executed by the provider, Mastra attempts to re-execute these tools even though they've already been executed. This causes:

1. "Tool not found" errors
2. Tool outputs not being properly recorded in telemetry
3. Broken tracing functionality

## Key Finding

The Vercel AI SDK v5 allows models to specify that a tool call event was `providerExecuted`, meaning it was executed by the underlying model provider and therefore does not need to be re-executed by the server. However, Mastra's `createToolCallStep` function always tries to execute tools regardless of this flag.

## Code Analysis

### Current Flow

1. **Tool Call Reception**: Tool calls come through the stream with a `providerExecuted` property in the payload (`packages/core/src/stream/types.ts:87`)
2. **Tool Storage**: Tool calls are stored in `MastraModelOutput#toolCalls` array (`packages/core/src/stream/base/output.ts:226`)
3. **Tool Extraction**: `llm-execution.ts` extracts tool calls using `outputStream._getImmediateToolCalls()` (line 542)
4. **Tool Execution**: `outer-llm-step.ts` passes ALL tool calls to `createToolCallStep` (line 168)
5. **Forced Execution**: `createToolCallStep` in `tool-call-step.ts` attempts to execute ALL tools without checking `providerExecuted` flag

### Problem Location

The issue is in `packages/core/src/loop/workflow/tool-call-step.ts`:

- The function attempts to find and execute the tool (lines 17-23, 38-83)
- It throws an error if the tool is not found (line 22)
- It doesn't check if the tool was already executed by the provider

### Expected Behavior

When `providerExecuted` is `true`:

1. Skip tool execution
2. Use the tool's existing output from the payload
3. Still emit telemetry with the tool input/output
4. Continue processing without errors

## Related Code Files

1. `packages/core/src/loop/workflow/tool-call-step.ts` - Main issue location
2. `packages/core/src/loop/workflow/outer-llm-step.ts` - Orchestrates tool execution
3. `packages/core/src/stream/types.ts` - Defines `providerExecuted` property
4. `packages/core/src/stream/base/output.ts` - Collects tool calls from stream
5. `packages/core/src/loop/workflow/llm-execution.ts` - Extracts tool calls for processing

## Test Evidence

The test files already show awareness of `providerExecuted`:

- `packages/core/src/loop/test-utils/tools.ts` has multiple test cases with `providerExecuted: true` (lines 31, 47, 54, etc.)
- `packages/core/src/stream/aisdk/v5/transform.ts` preserves `providerExecuted` during transformations (lines 139, 154, 167, etc.)

## Solution Approach

Modify `createToolCallStep` to:

1. Check if `inputData.providerExecuted` is true
2. If true, skip tool lookup and execution
3. Return the existing output from the payload
4. Still emit telemetry events with the provider-executed results

## Test Reproduction

Created a failing test in `packages/core/src/loop/test-utils/tools.ts` that:

1. Sends a tool-call event with `providerExecuted: true` and an output payload
2. Does not define the tool in the tools registry
3. Expects the stream to complete without errors

Test fails with: `Error: Tool claude_code_tool not found`

This confirms the issue - the system tries to execute provider-executed tools even when they shouldn't be executed.
