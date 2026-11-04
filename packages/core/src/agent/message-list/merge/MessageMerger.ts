import { CacheKeyGenerator } from '../cache/CacheKeyGenerator';
import type { MastraDBMessage, MastraMessageContentV2 } from '../state/types';
import { stampPart, stampToolPartUpdate } from '../utils/stamp-part';

type MessagePart = MastraMessageContentV2['parts'][number];

/**
 * Per-merge index over both messages' parts. Every part is keyed once and the per-key counts
 * are updated as parts are inserted, so inserting a part costs O(1) key work instead of
 * re-keying every part of both messages (which made merging quadratic in the part count).
 */
type MergeIndex = {
  keyOf: (part: MessagePart) => string;
  latestCounts: Map<string, number>;
  incomingCounts: Map<string, number>;
  /** First index of each part object in the incoming message (same result as `indexOf`). */
  incomingIndex: Map<MessagePart, number>;
  /** Index of the first incoming part that is not a step-start. */
  firstIncomingNonStepStart: number;
};

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

    // A boundary keeps the next response out of this message. Parts that still
    // carry this message's own id (a tool that was running when the boundary
    // landed, reporting its data parts and result) belong to it and must merge;
    // otherwise the add falls through to replace-by-id and drops its tool call.
    if (
      latestMessage.id !== incomingMessage.id &&
      (latestMessage.content?.metadata as { mastra?: { responseBoundary?: boolean } } | undefined)?.mastra
        ?.responseBoundary
    ) {
      return false;
    }

    // Don't merge completion result message (network uses completionResult, supervisor uses isTaskCompleteResult)
    if (
      incomingMessage.content.metadata?.completionResult ||
      latestMessage.content.metadata?.completionResult ||
      incomingMessage.content.metadata?.isTaskCompleteResult ||
      latestMessage.content.metadata?.isTaskCompleteResult
    ) {
      return false;
    }

    const latestParts = latestMessage.content?.parts ?? [];
    const latestOnlyHasDataParts = latestParts.length > 0 && latestParts.every(part => part.type.startsWith('data-'));
    if (latestOnlyHasDataParts && latestMessage.id !== incomingMessage.id) {
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
   * Merge an incoming assistant message into the latest assistant message.
   *
   * This preserves the existing message-level createdAt. OM uses that timestamp
   * as its observation boundary, so moving it forward can make an already
   * observed message look unobserved and eligible for reprocessing.
   *
   * This handles:
   * - Updating tool invocations with their results
   * - Adding new parts in the correct order using anchor maps
   * - Inserting step-start markers where needed
   * - Updating content strings
   */
  static merge(latestMessage: MastraDBMessage, incomingMessage: MastraDBMessage): void {
    if (incomingMessage.content.metadata) {
      latestMessage.content.metadata = {
        ...(latestMessage.content.metadata ?? {}),
        ...incomingMessage.content.metadata,
      };
    }

    // Used for mapping indexes for incomingMessage parts to corresponding indexes in latestMessage
    const toolResultAnchorMap = new Map<number, number>();
    const partsToAdd = new Map<number, MastraMessageContentV2['parts'][number]>();

    for (const [index, part] of incomingMessage.content.parts.entries()) {
      // If the incoming part is a tool-invocation result, find the corresponding call in the latest message
      if (part.type === 'tool-invocation') {
        if (!part.toolInvocation) continue;
        const existingCallPart = [...latestMessage.content.parts]
          .reverse()
          .find(p => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === part.toolInvocation.toolCallId);

        const existingCallToolInvocation = !!existingCallPart && existingCallPart.type === 'tool-invocation';

        if (existingCallToolInvocation) {
          const before = existingCallPart.toolInvocation;
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
            stampToolPartUpdate(existingCallPart, before, part.updatedAt);
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
              latestMessage.content.toolInvocations.push(
                existingCallPart.toolInvocation as NonNullable<MastraDBMessage['content']['toolInvocations']>[number],
              );
            } else {
              latestMessage.content.toolInvocations[toolInvocationIndex] =
                existingCallPart.toolInvocation as NonNullable<MastraDBMessage['content']['toolInvocations']>[number];
            }
          } else if (
            part.toolInvocation.state === 'approval-requested' ||
            part.toolInvocation.state === 'approval-responded' ||
            part.toolInvocation.state === 'output-denied' ||
            part.toolInvocation.state === 'output-error'
          ) {
            existingCallPart.toolInvocation = {
              ...existingCallPart.toolInvocation,
              state: part.toolInvocation.state,
              approval: part.toolInvocation.approval,
              errorText: part.toolInvocation.errorText,
              ...(part.toolInvocation.state === 'output-error' && part.toolInvocation.result !== undefined
                ? { result: part.toolInvocation.result }
                : {}),
              rawInput: part.toolInvocation.rawInput,
              args: {
                ...existingCallPart.toolInvocation.args,
                ...part.toolInvocation.args,
              },
            };
            stampToolPartUpdate(existingCallPart, before, part.updatedAt);

            if (part.providerMetadata) {
              existingCallPart.providerMetadata = {
                ...existingCallPart.providerMetadata,
                ...part.providerMetadata,
              };
            }

            if ('providerExecuted' in part && part.providerExecuted !== undefined) {
              existingCallPart.providerExecuted = part.providerExecuted;
            }

            if ('title' in part && part.title !== undefined) {
              existingCallPart.title = part.title;
            }

            if ('preliminary' in part && part.preliminary !== undefined) {
              existingCallPart.preliminary = part.preliminary;
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
    let previousLeftAnchor = -1;
    let insertionDrift = 0;
    const index = MessageMerger.createMergeIndex(latestMessage, incomingMessage);
    let window: { leftAnchor: number; parts: MessagePart[]; start: number; counts: Map<string, number> } | undefined;

    // Walk through incomingMessage, inserting any part not present at the canonical position
    for (let i = 0; i < incomingMessage.content.parts.length; ++i) {
      const part = incomingMessage.content.parts[i];
      if (!part) continue;
      const key = index.keyOf(part);
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

        // Shifted anchors already include insertions from earlier intervals.
        if (leftAnchorV2 !== previousLeftAnchor) {
          insertionDrift = 0;
          previousLeftAnchor = leftAnchorV2;
        }

        // Insert at proportional position, accounting for synthetic step-starts.
        const insertAt = leftAnchorLatest + offset + insertionDrift;

        const rightAnchorLatest =
          rightAnchorV2 !== -1 ? anchorMap.get(rightAnchorV2)! : latestMessage.content.parts.length;

        if (insertAt < 0 || insertAt > rightAnchorLatest) continue;

        // insertAt only moves forward within an interval and inserted parts always land before the
        // next insertAt, so [insertAt, rightAnchorLatest) is always a suffix of the parts the interval
        // held when first visited. Count that suffix once and trim it from the front instead of
        // rescanning the slice for every incoming part.
        if (!window || window.leftAnchor !== leftAnchorV2) {
          const parts = latestMessage.content.parts.slice(insertAt, rightAnchorLatest);
          const counts = new Map<string, number>();
          for (const p of parts) {
            const k = index.keyOf(p);
            counts.set(k, (counts.get(k) ?? 0) + 1);
          }
          window = { leftAnchor: leftAnchorV2, parts, start: 0, counts };
        }
        while (window.parts.length - window.start > rightAnchorLatest - insertAt) {
          const k = index.keyOf(window.parts[window.start++]!);
          window.counts.set(k, window.counts.get(k)! - 1);
        }

        if (!window.counts.get(key)) {
          const insertedCount = MessageMerger.pushNewPart({
            latestMessage,
            newMessage: incomingMessage,
            part,
            insertAt,
            index,
          });
          if (insertedCount === 0) continue;
          insertionDrift += insertedCount - 1;
          for (const [v2Idx, latestIdx] of anchorMap.entries()) {
            if (latestIdx >= insertAt) {
              anchorMap.set(v2Idx, latestIdx + insertedCount);
            }
          }
        }
      } else {
        MessageMerger.pushNewPart({
          latestMessage,
          newMessage: incomingMessage,
          part,
          index,
        });
      }
    }
  }

  private static createMergeIndex(latestMessage: MastraDBMessage, incomingMessage: MastraDBMessage): MergeIndex {
    const keys = new Map<MessagePart, string>();
    const keyOf = (part: MessagePart) => {
      let key = keys.get(part);
      if (key === undefined) {
        key = CacheKeyGenerator.fromDBParts([part]);
        keys.set(part, key);
      }
      return key;
    };
    const countKeys = (parts: MessagePart[]) => {
      const counts = new Map<string, number>();
      for (const part of parts) {
        const key = keyOf(part);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return counts;
    };

    const incomingParts = incomingMessage.content.parts;
    const incomingIndex = new Map<MessagePart, number>();
    incomingParts.forEach((part, i) => {
      if (!incomingIndex.has(part)) incomingIndex.set(part, i);
    });
    const firstNonStepStart = incomingParts.findIndex(p => p.type !== 'step-start');

    return {
      keyOf,
      latestCounts: countKeys(latestMessage.content.parts),
      incomingCounts: countKeys(incomingParts),
      incomingIndex,
      firstIncomingNonStepStart: firstNonStepStart === -1 ? incomingParts.length : firstNonStepStart,
    };
  }

  /**
   * Push a new message part to the latest message
   */
  private static pushNewPart({
    latestMessage,
    newMessage,
    part,
    insertAt,
    index,
  }: {
    latestMessage: MastraDBMessage;
    newMessage: MastraDBMessage;
    part: MastraMessageContentV2['parts'][number];
    insertAt?: number;
    index: MergeIndex;
  }): number {
    const partKey = index.keyOf(part);
    const latestPartCount = index.latestCounts.get(partKey) ?? 0;
    const newPartCount = index.incomingCounts.get(partKey) ?? 0;
    // If the number of parts in the latest message is less than the number of parts in the new message, insert the part
    if (latestPartCount < newPartCount) {
      // Check if we need to add a step-start when merging assistant messages: before text parts the
      // incoming message doesn't already precede with a step-start, and before a tool call that opens
      // the incoming step. Only add after tool invocations. Later tool calls in the same incoming
      // message are parallel calls of that step and stay together.
      const partIndex = index.incomingIndex.get(part) ?? -1;
      const hasStepStartBefore = partIndex > 0 && newMessage.content.parts[partIndex - 1]?.type === 'step-start';
      // An incoming step-start can be deduplicated against one already stored, so a tool call
      // preceded only by step-starts still opens a new step.
      const opensStep = partIndex <= index.firstIncomingNonStepStart;

      const needsStepStart =
        latestMessage.role === 'assistant' &&
        ((part.type === 'text' && !hasStepStartBefore) || (part.type === 'tool-invocation' && opensStep)) &&
        latestMessage.content.parts.length > 0 &&
        latestMessage.content.parts.at(-1)?.type === 'tool-invocation';

      let stepStartPart: MessagePart | undefined;
      if (needsStepStart) {
        const previousStepStart = latestMessage.content.parts.findLast(p => p.type === 'step-start');
        stepStartPart = previousStepStart?.model
          ? stampPart({
              type: 'step-start' as const,
              model: previousStepStart.model,
            })
          : ({ type: 'step-start' as const } as MessagePart);
        const stepStartKey = index.keyOf(stepStartPart);
        index.latestCounts.set(stepStartKey, (index.latestCounts.get(stepStartKey) ?? 0) + 1);
      }
      index.latestCounts.set(partKey, latestPartCount + 1);

      if (typeof insertAt === 'number') {
        if (stepStartPart) {
          latestMessage.content.parts.splice(insertAt, 0, stepStartPart);
          latestMessage.content.parts.splice(insertAt + 1, 0, part);
        } else {
          latestMessage.content.parts.splice(insertAt, 0, part);
        }
      } else {
        if (stepStartPart) {
          latestMessage.content.parts.push(stepStartPart);
        }
        latestMessage.content.parts.push(part);
      }
      return stepStartPart ? 2 : 1;
    }
    return 0;
  }
}
