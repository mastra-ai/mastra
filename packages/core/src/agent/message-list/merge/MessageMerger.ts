import { CacheKeyGenerator } from '../cache/CacheKeyGenerator';
import type { MastraDBMessage, MastraMessageContentV2 } from '../state/types';

/**
 * MessageMerger - Handles complex logic for merging assistant messages
 *
 * When streaming responses from LLMs, we often receive multiple messages that need to be
 * merged together:
 * - Tool calls that need to be updated with their results
 * - Text parts that need to be appended
 * - Step-start markers that need to be inserted
 *
 * This class encapsulates all the complex merging logic that was previously spread
 * throughout the MessageList.addOne method.
 */
export class MessageMerger {
  /**
   * Check if a message is sealed (should not be merged into).
   * Messages are sealed after observation to preserve observation markers.
   */
  static isSealed(message: MastraDBMessage): boolean {
    const metadata = message.content?.metadata as { mastra?: { sealed?: boolean } } | undefined;
    return metadata?.mastra?.sealed === true;
  }

  /**
   * Check if we should merge an incoming message with the latest message
   *
   * @param latestMessage - The most recent message in the list
   * @param incomingMessage - The message being added
   * @param messageSource - The source of the incoming message ('memory', 'input', 'response', 'context')
   * @param isLatestFromMemory - Whether the latest message is from memory
   * @param agentNetworkAppend - Whether agent network append mode is enabled
   */

  static shouldMerge(
    latestMessage: MastraDBMessage | undefined,
    incomingMessage: MastraDBMessage,
    messageSource: string,
    isLatestFromMemory: boolean,
    agentNetworkAppend: boolean = false,
  ): boolean {
    if (!latestMessage) return false;

    // Don't merge into sealed messages (e.g., messages that have been observed)
    if (MessageMerger.isSealed(latestMessage)) return false;

    // Don't merge completion result message (network uses completionResult, supervisor uses isTaskCompleteResult)
    if (
      incomingMessage.content.metadata?.completionResult ||
      latestMessage.content.metadata?.completionResult ||
      incomingMessage.content.metadata?.isTaskCompleteResult ||
      latestMessage.content.metadata?.isTaskCompleteResult
    ) {
      return false;
    }

    // Basic merge conditions: both messages must be assistant messages from the same thread
    const shouldAppendToLastAssistantMessage =
      latestMessage.role === 'assistant' &&
      incomingMessage.role === 'assistant' &&
      latestMessage.threadId === incomingMessage.threadId &&
      // If the message is from memory, don't append to the last assistant message
      messageSource !== 'memory';

    // Agent network append flag handling
    // When enabled, only merge if the latest message is NOT from memory
    const appendNetworkMessage = agentNetworkAppend ? !isLatestFromMemory : true;

    return shouldAppendToLastAssistantMessage && appendNetworkMessage;
  }

  /**
   * Merge an incoming assistant message into the latest assistant message
   *
   * This handles:
   * - Updating tool invocations with their results
   * - Adding new parts in the correct order using anchor maps
   * - Inserting step-start markers where needed
   * - Updating timestamps and content strings
   */
  static merge(latestMessage: MastraDBMessage, incomingMessage: MastraDBMessage): void {
    // Update timestamp
    latestMessage.createdAt = incomingMessage.createdAt || latestMessage.createdAt;

    // Used for mapping indexes for incomingMessage parts to corresponding indexes in latestMessage
    const toolResultAnchorMap = new Map<number, number>();
    const partsToAdd = new Map<number, MastraMessageContentV2['parts'][number]>();

    for (const [index, part] of incomingMessage.content.parts.entries()) {
      // If the incoming part is a tool-invocation result, find the corresponding call in the latest message
      if (part.type === 'tool-invocation') {
        const existingCallPart = [...latestMessage.content.parts]
          .reverse()
          .find(p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === part.toolInvocation.toolCallId);

        const existingCallToolInvocation = !!existingCallPart && existingCallPart.type === 'tool-invocation';

        if (existingCallToolInvocation) {
          if (part.toolInvocation.state === 'result') {
            // Update the existing tool-call part with the result
            existingCallPart.toolInvocation = {
              ...existingCallPart.toolInvocation,
              step: part.toolInvocation.step,
              state: 'result',
              result: part.toolInvocation.result,
              args: {
                ...existingCallPart.toolInvocation.args,
                ...part.toolInvocation.args,
              },
            };
            // Preserve providerMetadata from the result part (e.g. toModelOutput stored at mastra.modelOutput)
            if (part.providerMetadata) {
              existingCallPart.providerMetadata = {
                ...existingCallPart.providerMetadata,
                ...part.providerMetadata,
              };
            }
            if (!latestMessage.content.toolInvocations) {
              latestMessage.content.toolInvocations = [];
            }
            const toolInvocationIndex = latestMessage.content.toolInvocations.findIndex(
              t => t.toolCallId === existingCallPart.toolInvocation.toolCallId,
            );
            if (toolInvocationIndex === -1) {
              latestMessage.content.toolInvocations.push(existingCallPart.toolInvocation);
            } else {
              latestMessage.content.toolInvocations[toolInvocationIndex] = existingCallPart.toolInvocation;
            }
          }
          // Map the index of the tool call in incomingMessage to the index of the tool call in latestMessage
          const existingIndex = latestMessage.content.parts.findIndex(p => p === existingCallPart);
          toolResultAnchorMap.set(index, existingIndex);
          // Otherwise we do nothing, as we're not updating the tool call
        } else {
          partsToAdd.set(index, part);
        }
      } else {
        partsToAdd.set(index, part);
      }
    }

    MessageMerger.addPartsToMessage({
      latestMessage,
      incomingMessage,
      anchorMap: toolResultAnchorMap,
      partsToAdd,
    });

    if (latestMessage.createdAt.getTime() < incomingMessage.createdAt.getTime()) {
      latestMessage.createdAt = incomingMessage.createdAt;
    }
    if (!latestMessage.content.content && incomingMessage.content.content) {
      latestMessage.content.content = incomingMessage.content.content;
    }
    if (
      latestMessage.content.content &&
      incomingMessage.content.content &&
      latestMessage.content.content !== incomingMessage.content.content
    ) {
      // Match what AI SDK does - content string is always the latest text part.
      latestMessage.content.content = incomingMessage.content.content;
    }
  }

  /**
   * Add parts from the incoming message to the latest message using anchor positions
   */
  private static addPartsToMessage({
    latestMessage,
    incomingMessage,
    anchorMap,
    partsToAdd,
  }: {
    latestMessage: MastraDBMessage;
    incomingMessage: MastraDBMessage;
    anchorMap: Map<number, number>;
    partsToAdd: Map<number, MastraMessageContentV2['parts'][number]>;
  }): void {
    // Walk through incomingMessage, inserting any part not present at the canonical position
    for (let i = 0; i < incomingMessage.content.parts.length; ++i) {
      const part = incomingMessage.content.parts[i];
      if (!part) continue;
      const key = CacheKeyGenerator.fromDBParts([part]);
      const partToAdd = partsToAdd.get(i);
      if (!key || !partToAdd) continue;
      if (anchorMap.size > 0) {
        if (anchorMap.has(i)) continue; // skip anchors
        // Find left anchor in incomingMessage
        const leftAnchorV2 = [...anchorMap.keys()].filter(idx => idx < i).pop() ?? -1;
        // Find right anchor in incomingMessage
        const rightAnchorV2 = [...anchorMap.keys()].find(idx => idx > i) ?? -1;

        // Map to latestMessage
        const leftAnchorLatest = leftAnchorV2 !== -1 ? anchorMap.get(leftAnchorV2)! : 0;

        // Compute offset from anchor
        const offset = leftAnchorV2 === -1 ? i : i - leftAnchorV2;

        // Insert at proportional position
        const insertAt = leftAnchorLatest + offset;

        const rightAnchorLatest =
          rightAnchorV2 !== -1 ? anchorMap.get(rightAnchorV2)! : latestMessage.content.parts.length;

        if (
          insertAt >= 0 &&
          insertAt <= rightAnchorLatest &&
          !latestMessage.content.parts
            .slice(insertAt, rightAnchorLatest)
            .some(p => CacheKeyGenerator.fromDBParts([p]) === CacheKeyGenerator.fromDBParts([part]))
        ) {
          MessageMerger.pushNewPart({
            latestMessage,
            newMessage: incomingMessage,
            part,
            insertAt,
          });
          for (const [v2Idx, latestIdx] of anchorMap.entries()) {
            if (latestIdx >= insertAt) {
              anchorMap.set(v2Idx, latestIdx + 1);
            }
          }
        }
      } else {
        MessageMerger.pushNewPart({
          latestMessage,
          newMessage: incomingMessage,
          part,
        });
      }
    }
  }

  /**
   * Push a new message part to the latest message
   */
  private static pushNewPart({
    latestMessage,
    newMessage,
    part,
    insertAt,
  }: {
    latestMessage: MastraDBMessage;
    newMessage: MastraDBMessage;
    part: MastraMessageContentV2['parts'][number];
    insertAt?: number;
  }): void {
    const partKey = CacheKeyGenerator.fromDBParts([part]);
    const latestPartCount = latestMessage.content.parts.filter(
      p => CacheKeyGenerator.fromDBParts([p]) === partKey,
    ).length;
    const newPartCount = newMessage.content.parts.filter(p => CacheKeyGenerator.fromDBParts([p]) === partKey).length;
    // If the number of parts in the latest message is less than the number of parts in the new message, insert the part
    if (latestPartCount < newPartCount) {
      // Check if we need to add a step-start before text parts when merging assistant messages
      // Only add after tool invocations, and only if the incoming message doesn't already have step-start
      const partIndex = newMessage.content.parts.indexOf(part);
      const hasStepStartBefore = partIndex > 0 && newMessage.content.parts[partIndex - 1]?.type === 'step-start';

      const needsStepStart =
        latestMessage.role === 'assistant' &&
        part.type === 'text' &&
        !hasStepStartBefore &&
        latestMessage.content.parts.length > 0 &&
        latestMessage.content.parts.at(-1)?.type === 'tool-invocation';

      if (typeof insertAt === 'number') {
        if (needsStepStart) {
          latestMessage.content.parts.splice(insertAt, 0, { type: 'step-start' });
          latestMessage.content.parts.splice(insertAt + 1, 0, part);
        } else {
          latestMessage.content.parts.splice(insertAt, 0, part);
        }
      } else {
        if (needsStepStart) {
          latestMessage.content.parts.push({ type: 'step-start' });
        }
        latestMessage.content.parts.push(part);
      }
    }
  }
}
