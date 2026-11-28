import { CacheKeyGenerator } from '../cache/CacheKeyGenerator';
import type { MastraDBMessage, MastraMessageContentV2 } from '../state/types';
import { stampPart, stampToolPartUpdate } from '../utils/stamp-part';
import { isStoredCopyOfInvocation, isTerminalToolInvocationState } from '../utils/tool-invocation-state';

type MessagePart = MastraMessageContentV2['parts'][number];

export type MessageMergeOptions = {
  /**
   * Whether a pending call whose id already has a stored invocation opens a new occurrence of that id
   * instead of anchoring in place. Defaults to true: a gateway can restart tool-call numbering in a
   * later step of the same run, so one id can name two invocations (#31609).
   *
   * Folding stored history passes false. That merge runs the live copy's own parts over the stored
   * row after `withoutStaleToolStates` dressed every stale tool part as a bare pending call purely
   * so the merger keeps it as a positional anchor. In that mode a pending call anchors to the stored
   * copy it echoes (same arguments) instead of opening an occurrence of its own, while a part that
   * describes a different invocation of the id is still kept as its own occurrence.
   */
  openNewOccurrences?: boolean;
};

/**
 * Per-merge index over both messages' parts. Every part is keyed once and the per-key counts
 * are updated as parts are inserted, so inserting a part costs O(1) key work instead of
 * re-keying every part of both messages (which made merging quadratic in the part count).
 */
type MergeIndex = {
  keyOf: (part: MessagePart) => string;
  latestCounts: Map<string, number>;
  incomingCounts: Map<string, number>;
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
  static merge(
    latestMessage: MastraDBMessage,
    incomingMessage: MastraDBMessage,
    options: MessageMergeOptions = {},
  ): void {
    const openNewOccurrences = options.openNewOccurrences ?? true;
    // Whether the incoming message is a response newer than the message being merged into. A part on a
    // newer response is a new event for its call even when it repeats a stored call's id and
    // arguments (a gateway can restart numbering every response), whereas the runtime re-adds
    // accumulated parts on the message they were first stored on, so a replay never lands on a newer
    // message (#31609). Folding stored history (`openNewOccurrences: false`) deliberately treats
    // everything it is given as a replay.
    const incomingIsNewerResponse =
      openNewOccurrences &&
      typeof incomingMessage.createdAt !== 'undefined' &&
      typeof latestMessage.createdAt !== 'undefined' &&
      new Date(incomingMessage.createdAt).getTime() > new Date(latestMessage.createdAt).getTime();
    if (incomingMessage.content.metadata) {
      latestMessage.content.metadata = {
        ...(latestMessage.content.metadata ?? {}),
        ...incomingMessage.content.metadata,
      };
    }

    // Used for mapping indexes for incomingMessage parts to corresponding indexes in latestMessage
    const toolResultAnchorMap = new Map<number, number>();
    const partsToAdd = new Map<number, MastraMessageContentV2['parts'][number]>();
    // Incoming parts that are an invocation of their own even though the merge-gate counts treat them
    // as duplicates of one already stored under the same id and state.
    const forcedInserts = new Set<number>();
    // Invocations this incoming response opens for a toolCallId whose stored invocation already
    // finished. A gateway can restart tool-call numbering every response, so a later step reuses an
    // id; a result in the same response must pair with the call it belongs to instead of overwriting
    // the earlier, already-finished invocation (#31609).
    const openedInvocations = new Map<string, Extract<MessagePart, { type: 'tool-invocation' }>>();
    // Every stored invocation by the id it carries, with its position, so an incoming part can find
    // the stored copies of its own id without rescanning the message. Nothing this loop does appends
    // to the stored parts: parts it decides to add are only merged in afterwards, by
    // `addPartsToMessage`.
    const storedInvocationsByToolCallId = new Map<
      string,
      { part: Extract<MessagePart, { type: 'tool-invocation' }>; index: number }[]
    >();
    // A step-start already stored after an occurrence means a later step of the run has begun, so an
    // incoming part whose id matches that occurrence belongs to the new step rather than re-describing
    // the earlier one (#31609).
    let lastStoredStepStartIndex = -1;
    for (const [storedIndex, storedPart] of latestMessage.content.parts.entries()) {
      if (storedPart.type === 'step-start') {
        lastStoredStepStartIndex = storedIndex;
        continue;
      }
      if (storedPart.type !== 'tool-invocation' || !storedPart.toolInvocation) continue;
      const { toolCallId } = storedPart.toolInvocation;
      const copies = storedInvocationsByToolCallId.get(toolCallId);
      if (copies) copies.push({ part: storedPart, index: storedIndex });
      else storedInvocationsByToolCallId.set(toolCallId, [{ part: storedPart, index: storedIndex }]);
    }

    for (const [index, part] of incomingMessage.content.parts.entries()) {
      // If the incoming part is a tool-invocation result, find the corresponding call in the latest message
      if (part.type === 'tool-invocation') {
        if (!part.toolInvocation) continue;
        const toolCallId = part.toolInvocation.toolCallId;
        const isCallState = part.toolInvocation.state === 'call' || part.toolInvocation.state === 'partial-call';
        // A call this response opened for the id is the match for any later part carrying it,
        // ahead of the invocations already stored in the message.
        const openedPart = openedInvocations.get(toolCallId);
        const storedInvocations = storedInvocationsByToolCallId.get(toolCallId) ?? [];
        // Copies of the id that describe this very call, and copies still waiting for their outcome.
        // A part that starts its own invocation (a newer response whose stored copy a step-start
        // already follows) is a new event for the call, not a copy of it.
        const sameCall = storedInvocations
          .filter(({ part: storedPart, index: storedIndex }) =>
            isStoredCopyOfInvocation(
              storedPart,
              part,
              incomingIsNewerResponse && storedIndex < lastStoredStepStartIndex,
            ),
          )
          .map(({ part: storedPart }) => storedPart);
        const pending = storedInvocations
          .filter(({ part: storedPart }) => !isTerminalToolInvocationState(storedPart.toolInvocation.state))
          .map(({ part: storedPart }) => storedPart);
        const existingCallPart =
          openedPart ?? MessageMerger.matchStoredInvocation({ isCallState, openNewOccurrences, sameCall, pending });
        const existingCallToolInvocation = !!existingCallPart;

        if (isCallState) {
          if (openedPart) continue; // same invocation this response already opened
          if (existingCallToolInvocation) {
            // The id is already queued, so this is the same invocation arriving in pieces (or, when
            // folding stored history, the copy this part echoes): keep the stored one and anchor it.
            const existingIndex = latestMessage.content.parts.findIndex(p => p === existingCallPart);
            toolResultAnchorMap.set(index, existingIndex);
            continue;
          }
          // Repeating an id whose stored invocation already finished starts a new occurrence: add it,
          // and remember it so a result later in this same response updates this call, not the stored one.
          const newPart: Extract<MessagePart, { type: 'tool-invocation' }> = {
            ...part,
            toolInvocation: { ...part.toolInvocation },
          };
          partsToAdd.set(index, newPart);
          if (storedInvocations.length > 0) {
            openedInvocations.set(toolCallId, newPart);
            // A result in this same response turns the copy above into a `result`-state part, whose
            // cache key (id + state) then equals the already-stored outcome's, so the merge-gate counts
            // would read it as a duplicate and drop the whole occurrence (#31609).
            forcedInserts.add(index);
          }
          continue;
        }

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
            // Only an invocation that is already stored has a legacy entry to sync.
            if (!openedPart) {
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
          // Map the index of the tool call in incomingMessage to the index of the tool call in latestMessage.
          // A call this response opened is inserted from partsToAdd instead, so it has no stored index.
          if (!openedPart) {
            const existingIndex = latestMessage.content.parts.findIndex(p => p === existingCallPart);
            toolResultAnchorMap.set(index, existingIndex);
          }
        } else if (storedInvocations.length > 0 && isTerminalToolInvocationState(part.toolInvocation.state)) {
          // An outcome for a reused id that matches none of the stored copies belongs to an invocation
          // of its own, so it is inserted even though the merge-gate counts see a duplicate.
          partsToAdd.set(index, part);
          forcedInserts.add(index);
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
      forcedInserts,
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
   * Pick the stored invocation an incoming tool part belongs to, or `undefined` when the part is an
   * occurrence of its own because an earlier one already finished under the same id (#31609).
   *
   * A call repeats the invocation already queued for the id: the only pending copy can be that call's,
   * even when its arguments are still streaming in piecewise. Folding stored history instead anchors
   * a pending part to the copy it echoes.
   *
   * Any other part completes the call it reports, so it prefers the copy describing the same call and
   * falls back to the one copy of the id still waiting for an outcome.
   */
  private static matchStoredInvocation({
    isCallState,
    openNewOccurrences,
    sameCall,
    pending,
  }: {
    isCallState: boolean;
    openNewOccurrences: boolean;
    sameCall: Extract<MessagePart, { type: 'tool-invocation' }>[];
    pending: Extract<MessagePart, { type: 'tool-invocation' }>[];
  }): Extract<MessagePart, { type: 'tool-invocation' }> | undefined {
    if (isCallState) return (openNewOccurrences ? pending : sameCall).at(-1);
    return (sameCall.at(-1) ?? pending.at(-1)) as Extract<MessagePart, { type: 'tool-invocation' }> | undefined;
  }

  /**
   * Add parts from the incoming message to the latest message using anchor positions
   */
  private static addPartsToMessage({
    latestMessage,
    incomingMessage,
    anchorMap,
    partsToAdd,
    forcedInserts,
  }: {
    latestMessage: MastraDBMessage;
    incomingMessage: MastraDBMessage;
    anchorMap: Map<number, number>;
    partsToAdd: Map<number, MastraMessageContentV2['parts'][number]>;
    forcedInserts: Set<number>;
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

        // `forcedInserts` parts are an invocation of their own even though a part with the same key is
        // already stored (a reused id's own result), so the window count must not suppress them.
        const forced = forcedInserts.has(i);
        if (forced || !window.counts.get(key)) {
          const insertedCount = MessageMerger.pushNewPart({
            latestMessage,
            newMessage: incomingMessage,
            part: partToAdd,
            partIndex: i,
            insertAt,
            index,
            force: forced,
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
          part: partToAdd,
          partIndex: i,
          index,
          force: forcedInserts.has(i),
        });
      }
    }
  }

  private static createMergeIndex(latestMessage: MastraDBMessage, incomingMessage: MastraDBMessage): MergeIndex {
    const keys = new Map<MessagePart, string>();
    const baseKeyOf = (part: MessagePart) => CacheKeyGenerator.fromDBParts([part]);
    const dataPartId = (part: MessagePart) =>
      part.type.startsWith('data-') && 'id' in part && typeof part.id === 'string' ? part.id : undefined;
    // Data part ids only distinguish parts when both sides carry ids. A stored part without an id
    // (legacy rows, regular-agent persistence) still matches one incoming copy that has an id the
    // other side lacks; every other id keeps its own key. The id-less part matches the last such
    // copy, so suppressing it doesn't shift where the earlier ones are inserted.
    const keyParts = (parts: MessagePart[], otherParts: MessagePart[]) => {
      const otherIds = new Set<string>();
      const otherIdless = new Map<string, number>();
      for (const part of otherParts) {
        if (!part.type.startsWith('data-')) continue;
        const baseKey = baseKeyOf(part);
        const id = dataPartId(part);
        if (id !== undefined) otherIds.add(`${baseKey}|id:${JSON.stringify(id)}`);
        else otherIdless.set(baseKey, (otherIdless.get(baseKey) ?? 0) + 1);
      }
      for (const part of [...parts].reverse()) {
        if (keys.has(part)) continue;
        const baseKey = baseKeyOf(part);
        const id = dataPartId(part);
        const unmatched = otherIdless.get(baseKey) ?? 0;
        const idKey = id !== undefined ? `${baseKey}|id:${JSON.stringify(id)}` : undefined;
        if (idKey !== undefined && !otherIds.has(idKey) && unmatched > 0) {
          otherIdless.set(baseKey, unmatched - 1);
          keys.set(part, baseKey);
        } else {
          keys.set(part, idKey ?? baseKey);
        }
      }
    };
    keyParts(latestMessage.content.parts, incomingMessage.content.parts);
    keyParts(incomingMessage.content.parts, latestMessage.content.parts);
    const keyOf = (part: MessagePart) => {
      let key = keys.get(part);
      if (key === undefined) {
        key = baseKeyOf(part);
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
    const firstNonStepStart = incomingParts.findIndex(p => p.type !== 'step-start');

    return {
      keyOf,
      latestCounts: countKeys(latestMessage.content.parts),
      incomingCounts: countKeys(incomingParts),
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
    partIndex,
    insertAt,
    index,
    force,
  }: {
    latestMessage: MastraDBMessage;
    newMessage: MastraDBMessage;
    part: MastraMessageContentV2['parts'][number];
    /** Index of the incoming part this one stands for; `part` itself may be a copy of it. */
    partIndex: number;
    insertAt?: number;
    index: MergeIndex;
    /** Insert even when the counts say this part is already present (a reused id's own occurrence). */
    force?: boolean;
  }): number {
    const partKey = index.keyOf(part);
    const latestPartCount = index.latestCounts.get(partKey) ?? 0;
    const newPartCount = index.incomingCounts.get(partKey) ?? 0;
    // If the number of parts in the latest message is less than the number of parts in the new message, insert the part
    if (force || latestPartCount < newPartCount) {
      // Check if we need to add a step-start when merging assistant messages: before text parts the
      // incoming message doesn't already precede with a step-start, and before a tool call that opens
      // the incoming step. Only add after tool invocations. Later tool calls in the same incoming
      // message are parallel calls of that step and stay together.
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
