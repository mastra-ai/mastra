# Agent MessageList Refactoring Summary

This document summarizes the changes made to integrate the `MessageList` class into the `Agent` and `Memory` systems, aiming for a more robust and non-lossy message handling architecture.

## I. `ARCHITECTURE.md`

1.  **Created `ARCHITECTURE.md`**: Documented the initial state of message handling in the `Agent` class.
2.  **Defined Target Architecture**: Updated `ARCHITECTURE.md` to describe the new message handling flow centered around the `MessageList` class. Key aspects include:
    *   `MessageList` as the central manager for message state and transformations.
    *   `Agent` delegating message operations to `MessageList`.
    *   Internal use of `MastraMessageV2` within `MessageList`.
    *   `MessageList` providing `UIMessage[]` for AI SDK interactions and `MastraMessageV2[]` for storage.
    *   Removal of `sanitizeResponseMessages` and `getResponseMessages` from `Agent`.

## II. `packages/core/src/agent/index.ts` (`Agent` class)

1.  **Imported `MessageList`**.
2.  **Refactored `__primitive` method**:
    *   **`before` function**:
        *   Instantiates `MessageList` at the beginning, passing `threadId` and `resourceId`.
        *   Adds `systemMessage`, `context` messages, and the initial `messages` (current turn's user input) to the `MessageList` instance.
        *   Calls `preExecute` (which in turn calls `fetchMemory`), passing the `messageList`. `fetchMemory` now modifies this `messageList` in place.
        *   Retrieves messages for the LLM using `messageList.toUIMessages()`.
        *   Returns the `messageListInstance` for use in the `after` function.
    *   **`after` function**:
        *   Accepts the `messageListInstance`.
        *   Adds LLM response messages to the `messageListInstance`.
        *   Calls `memory.saveMessages(messageListInstance.getMessages())`.
3.  **Refactored `fetchMemory` method**:
    *   Signature updated to accept `messageList: MessageList` (instead of `userMessages` and `systemMessage`).
    *   No longer returns a list of messages; it modifies the passed-in `messageList` in place.
    *   Logic updated to extract `currentUserMessages` from the provided `messageList` for vector search.
    *   Clears and repopulates the `messageList` with: original system message, memory system message, historical messages from memory, and finally the `currentUserMessages`.
4.  **Refactored `preExecute` method**:
    *   Signature updated to accept `messageList: MessageList`.
    *   Passes the `messageList` to `fetchMemory`.
    *   Returns only `{ threadIdToUse }` as message modifications happen on the `messageList` instance directly.
5.  **Simplified `generate` and `stream` methods**:
    *   Removed manual conversion of input `messages` to `CoreMessage[]` (`messagesToUse` block).
    *   Raw `messages` input is now passed directly to `__primitive`.
6.  **Updated `messages` parameter type in `__primitive`** to `string | string[] | CoreMessage[] | AiMessageType[]`.
7.  **Removed `getResponseMessages` and `sanitizeResponseMessages` methods**.
8.  **Removed import of `ensureAllMessagesAreCoreMessages`**.

## III. `packages/core/src/utils.ts`

1.  **Removed `ensureAllMessagesAreCoreMessages` function definition**.

## IV. `packages/memory/src/index.ts` (`Memory` class - implementation of `MastraMemory`)

1.  **Refactored `saveMessages` method**:
    *   Signature updated to accept and return `Promise<MastraMessageV2[]>`.
    *   Internal calls to `saveWorkingMemory` and `updateMessagesToHideWorkingMemory` now pass/expect `MastraMessageV2[]`.
    *   Logic for extracting `textForEmbedding` updated for `MastraMessageV2` structure.
2.  **Refactored `saveWorkingMemory` method**:
    *   Signature updated to accept `MastraMessageV2[]`.
    *   Logic for extracting `latestContent` from `MastraMessageV2` updated.
3.  **Refactored `updateMessagesToHideWorkingMemory` method**:
    *   Signature updated to accept and return `MastraMessageV2[]`.
    *   Internal logic for finding and replacing working memory tags updated for `MastraMessageV2` structure.
4.  **Refactored `query` method**:
    *   Return type changed to `Promise<{ messages: MastraMessageV2[] }> `.
    *   Assumes `this.storage.getMessages` will return `MastraMessageV2[]` (pending storage layer update).
    *   Calls to `this.parseMessages` and `this.convertToUIMessages` removed.
    *   `reorderToolCallsAndResults` is called (noted as needing update for `MastraMessageV2[]`).
5.  **Refactored `rememberMessages` method**:
    *   Return type changed to `Promise<{ messages: MastraMessageV2[] }> `.
    *   Adjusted to use the updated `query` method.

## V. `packages/core/src/memory/memory.ts` (`MastraMemory` abstract class)

1.  **Removed `parseMessages` and `convertToUIMessages` method definitions** (they were concrete implementations in this abstract class, which is unusual but was the case).
2.  **Updated abstract method signatures**:
    *   `rememberMessages`: Parameter `systemMessage?: CoreMessage` removed; return type changed to `Promise<{ messages: MastraMessageV2[] }> `.
    *   `saveMessages`: Parameter `messages: MessageType[]` changed to `messages: MastraMessageV2[]`; return type changed to `Promise<MastraMessageV2[]>`.
    *   `query`: Return type changed to `Promise<{ messages: MastraMessageV2[] }> `.
3.  **Refactored `addMessage` method**:
    *   Return type changed to `Promise<MastraMessageV2>`.
    *   Constructs a `MastraMessageV2` (simplified content handling for now).
    *   Parameters `type`, `toolNames`, `toolCallArgs`, `toolCallIds` removed.

## Pending Items / Next Steps Highlighted During Refactor:

1.  **`reorderToolCallsAndResults` utility** (likely in `packages/memory/src/utils.ts` or similar): Needs update to work with `MastraMessageV2[]`.
2.  **Storage Layer (e.g., `DefaultStorage`)**: Needs to be updated to store and retrieve `MastraMessageV2` instead of `MessageType`.
3.  **`processMessages` in `MastraMemory`**: Role to be clarified; if kept, needs update for `MastraMessageV2`.
4.  **Type Definitions**: Ensure overall consistency, especially around `MessageType` vs. `MastraMessageV2`.
5.  **Thorough Testing** of all changes.
