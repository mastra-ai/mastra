# Agent Message Handling Architecture

This document outlines the message handling process within the Mastra Agent.


## Target Architecture (with MessageList)

The new architecture will centralize message handling within the `MessageList` class. The `Agent` will delegate message management tasks to `MessageList`, simplifying its own logic.

.  **Input Messages**: `generate` and `stream` methods will receive messages in their current formats.
.  **MessageList Initialization**: An instance of `MessageList` will be created at the beginning of `generate`/`stream`.
.  **Adding Messages to List**:
    *   All incoming messages (initial user messages, context messages, messages from memory) will be added to the `MessageList` instance using `messageList.add()`. `MessageList` will handle internal conversion to its V2 format.
    *   LLM response messages will also be added to the same `MessageList` instance.
.  **Memory Interaction**:
    *   **Saving**: When saving messages to memory, `MessageList.getMessages()` will provide `MastraMessageV2[]`. The memory system will be responsible for storing this format (or adapting it if necessary).
    *   **Retrieving**: Messages fetched from memory (which should be in `MastraMessageV2` format or convertible to it) will be added to the `MessageList` using `messageList.add()`.
    *   System messages, including working memory, will be constructed by the `Agent` or `Memory` system and can be added to the `MessageList` if they need to be part of the history, or handled separately if they are only for the current LLM call.
.  **Preparing Messages for LLM**: 
    *   When messages are needed for the LLM, `messageList.toUIMessages()` will be called. The AI SDK's `generateText` or `streamText` functions will handle the conversion from `UIMessage[]` to the `CoreMessage[]` format they expect internally.
.  **Tool Conversion**: Tool conversion logic remains within the `Agent` but operates on tools provided, not directly by manipulating message content for tool calls/results.
.  **Response Handling**:
    *   The LLM's response messages (as `CoreMessage[]`) will be added to the `MessageList` using `messageList.add()`. `MessageList` will handle merging tool results with their corresponding tool calls and any other necessary normalization.
    *   The `sanitizeResponseMessages` method in the `Agent` will be **removed**. Its responsibilities (filtering, merging tool call/results) will be handled by `MessageList` during the `add()` operation.
    *   The `getResponseMessages` method in the `Agent` will be **removed**. `MessageList` will manage message IDs and timestamps internally.
.  **Output Formatting**: The final result for the caller will be derived from the `MessageList` or the direct LLM output as appropriate.

**Key Changes & Benefits:**

*   **Centralized Logic**: `MessageList` becomes the single source of truth for message state and transformations.
*   **Simplified Agent**: The `Agent` class will be significantly simplified, with less direct message manipulation.
*   **Consistent Format**: Internally, `MessageList` uses `MastraMessageV2`. It provides `UIMessage[]` for the AI SDK and `MastraMessageV2[]` for storage.
*   **Reduced Conversions**: Explicit conversions by the `Agent` are minimized. `MessageList` handles its internal format, and the AI SDK handles its needs.
*   **Clearer Deduplication/Merging**: All such logic will be encapsulated within `MessageList.add()`.

## Current Architecture

The `Agent` class currently handles messages through a series of transformations and direct manipulations. Here's a breakdown of the typical flow:

1.  **Input Messages**: The `generate` and `stream` methods receive messages in various formats (string, string[], CoreMessage[], AiMessageType[]).
2.  **Initial Conversion**: These input messages are converted to an array of `CoreMessage` objects.
3.  **Memory Interaction**:
    *   If memory is enabled, user messages are saved.
    *   Relevant historical messages are fetched from memory.
    *   A system message, potentially including working memory, is constructed.
4.  **Message Aggregation**: The system message, context messages (if any), and current user messages are combined.
5.  **Tool Conversion**: Tools (assigned, memory, toolsets, client, workflow) are converted into a format suitable for the LLM.
6.  **LLM Call**: The aggregated messages and converted tools are passed to the `MastraLLM` instance (e.g., `llm.__text()`, `llm.__stream()`).
7.  **Response Handling**:
    *   The LLM's response (text, tool calls, structured objects) is received.
    *   **`sanitizeResponseMessages`**: This internal `Agent` method is called to process the LLM's response messages and historical messages. It performs several key functions:
        *   **Filtering Incomplete Tool Sequences**: It ensures that tool calls have corresponding tool results. If a `tool-call` exists without a subsequent `tool-result`, or a `tool-result` exists without a preceding `tool-call` with the same `toolCallId`, these orphaned parts are often removed.
        *   **Filtering Empty Text**: Text parts that are empty or contain only whitespace might be removed.
        *   **Message Aggregation/Compaction**: It can sometimes merge or alter messages, especially around tool call/result sequences, to ensure a coherent history for the next LLM turn.
    *   The `getResponseMessages` method is used to format LLM response messages into `MessageType` (Mastra's internal V1 message format) before saving to memory. This involves:
        *   Assigning IDs and timestamps.
        *   Extracting tool call details (IDs, args, names).
        *   Determining a message `type` (text, tool-call, tool-result).
8.  **Memory Persistence**:
    *   The processed response messages from the LLM, along with the initial user messages, are saved to memory. This involves converting them to `MessageType`.
    *   Working memory might be updated based on the LLM's output.
9.  **Output Formatting**: The final result is formatted for the caller (e.g., `GenerateTextResult`, `StreamTextResult`).

**Key Transformation Points:**

*   **Input to `CoreMessage`**: At the beginning of `generate`/`stream`.
*   **`Agent.sanitizeResponseMessages`**: Applied to messages retrieved from memory and messages from the LLM response before they are passed back to the LLM in multi-turn scenarios or saved. This is a significant point of custom logic for cleaning up message history, especially around tool usage.
*   **`Agent.getResponseMessages`**: Converts LLM output `CoreMessage`s to `MessageType` for storage. This method also assigns IDs and timestamps.
*   **`MastraMemory.parseMessages` / `convertToUIMessages`**: When retrieving messages, `MastraMemory` (specifically the `Memory` class in `@mastra/memory`) converts stored `MessageType` objects back into `CoreMessage` or `UIMessage` arrays.

**Challenges with Current Architecture:**

*   **Distributed Logic**: Message transformation logic is spread across the `Agent` class and potentially within memory implementations.
*   **Multiple Conversions**: Messages are converted between formats (input -> `CoreMessage` -> `MessageType` -> `CoreMessage`/`UIMessage`) multiple times.
*   **Complexity in `sanitizeResponseMessages`**: This method has grown to handle various edge cases and cleanup tasks, making it complex.
*   **Implicit Deduplication/Merging**: Some message processing steps might implicitly deduplicate or merge messages without a clear, centralized strategy.
*   **Direct Manipulation**: The `Agent` directly manipulates message arrays and their content.
