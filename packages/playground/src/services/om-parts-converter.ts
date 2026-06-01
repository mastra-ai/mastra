import type { MastraDBMessage } from '@mastra/core/agent/message-list';

/**
 * Converts a data-om-* part to dynamic-tool format so toAssistantUIMessage can transform it.
 * The ToolFallback component will detect the om-observation-* prefix and render ObservationMarkerBadge.
 *
 * Input: { type: 'data-om-observation-start', data: {...} }
 * Output: { type: 'dynamic-tool', toolCallId, toolName: 'om-observation-start', input: {...}, output: {...}, state: 'output-available' }
 */
const OM_TOOL_NAME = 'mastra-memory-om-observation';

type OmCycleParts = {
  start?: any;
  end?: any;
  failed?: any;
  bufferingStart?: any;
  bufferingEnd?: any;
  bufferingFailed?: any;
  activation?: any;
};

/**
 * Index data-om-* parts by cycleId from an array of parts.
 * Merges into an existing map so it can be called across multiple messages.
 */
const indexOmPartsByCycleId = (parts: any[], target: Map<string, OmCycleParts>) => {
  for (const part of parts) {
    const cycleId = (part as any).data?.cycleId;
    if (!cycleId) continue;

    const typeToKey: Record<string, keyof OmCycleParts> = {
      'data-om-observation-start': 'start',
      'data-om-observation-end': 'end',
      'data-om-observation-failed': 'failed',
      'data-om-buffering-start': 'bufferingStart',
      'data-om-buffering-end': 'bufferingEnd',
      'data-om-buffering-failed': 'bufferingFailed',
      'data-om-activation': 'activation',
    };

    const key = typeToKey[part.type];
    if (key) {
      const existing = target.get(cycleId) || {};
      existing[key] = part;
      target.set(cycleId, existing);
    }
  }
  return target;
};

/**
 * Build a global map of all OM cycle parts across all messages.
 * This gives each per-message converter the full picture of a cycle's state
 * (e.g., buffering-start on message A, activation on message B).
 */
export const buildGlobalOmPartsByCycleId = (messages: MastraDBMessage[]) => {
  const map = new Map<string, OmCycleParts>();
  for (const msg of messages) {
    const parts = msg?.content?.parts;
    if (!Array.isArray(parts)) continue;
    indexOmPartsByCycleId(parts, map);
  }
  return map;
};

/**
 * Combines data-om-* parts in a message into single tool calls by cycleId.
 * - start marker creates a tool call in 'input-available' (loading) state
 * - end/failed marker with same cycleId updates it to 'output-available' (complete) state
 * If both start and end exist for the same cycleId, only the final state is kept.
 * The tool call is placed at the position of the START marker to preserve order.
 *
 * Note: cycleId is unique per observation cycle, while recordId is constant for the entire
 * memory record. Using cycleId ensures each observation cycle gets its own UI element.
 *
 * @param globalOmParts - Pre-built map of all OM cycle parts across ALL messages.
 *   This allows the converter to know the full state of a cycle even when its parts
 *   span multiple messages (e.g., buffering-start on msg A, activation on msg B).
 */
export const convertOmPartsInMastraMessage = (
  message: MastraDBMessage,
  globalOmParts: Map<string, OmCycleParts>,
): MastraDBMessage => {
  if (!message || !Array.isArray(message.content?.parts)) {
    return message;
  }

  // Build new parts array. Badges are ONLY rendered at start marker positions
  // (data-om-observation-start, data-om-buffering-start). All other OM parts
  // (end, failed, activation, status) are silently dropped — their data is already
  // captured in globalOmParts and merged into the badge at the start position.
  // This ensures badges stay in their original position even after reload.
  const convertedParts: any[] = [];

  for (const part of message.content.parts) {
    const cycleId = (part as any).data?.cycleId;
    const partType = part.type as string;

    // Only render badges at start marker positions
    if (partType === 'data-om-observation-start' && cycleId) {
      const cycle = globalOmParts.get(cycleId);
      if (!cycle) continue;

      const startData = cycle.start?.data || {};
      const endData = cycle.end?.data || {};
      const failedData = cycle.failed?.data || {};

      const isFailed = !!cycle.failed;
      const isComplete = !!cycle.end;
      const isDisconnected = !!startData.disconnectedAt || (isComplete && !!endData.disconnectedAt);
      const isLoading = !isFailed && !isComplete && !isDisconnected;

      const mergedData = {
        ...startData,
        ...(isComplete ? endData : {}),
        ...(isFailed ? failedData : {}),
        _state: isFailed ? 'failed' : isDisconnected ? 'disconnected' : isComplete ? 'complete' : 'loading',
      };

      convertedParts.push({
        type: 'dynamic-tool',
        toolCallId: `om-observation-${cycleId}`,
        toolName: OM_TOOL_NAME,
        input: mergedData,
        output: isLoading
          ? undefined
          : {
              status: isFailed ? 'failed' : isDisconnected ? 'disconnected' : 'complete',
              omData: mergedData,
            },
        state: isLoading ? 'input-available' : 'output-available',
      });
    } else if (partType === 'data-om-buffering-start' && cycleId) {
      const cycle = globalOmParts.get(cycleId);
      if (!cycle) continue;

      const startData = cycle.bufferingStart?.data || {};
      const endData = cycle.bufferingEnd?.data || {};
      const failedData = cycle.bufferingFailed?.data || {};
      const activationData = cycle.activation?.data || {};

      const isFailed = !!cycle.bufferingFailed;
      const isActivated = !!cycle.activation;
      const isComplete = !!cycle.bufferingEnd;
      const isDisconnected = !!startData.disconnectedAt;
      const isLoading = !isFailed && !isActivated && !isComplete && !isDisconnected;

      const mergedData: Record<string, unknown> = {
        ...startData,
        ...(isComplete ? endData : {}),
        ...(isFailed ? failedData : {}),
        ...(isActivated ? activationData : {}),
        _state: isFailed
          ? 'buffering-failed'
          : isActivated
            ? 'activated'
            : isDisconnected
              ? 'disconnected'
              : isComplete
                ? 'buffering-complete'
                : 'buffering',
      };
      // Map activation fields to badge fields so they display correctly on reload
      // (activation markers use tokensActivated, but the badge reads tokensObserved)
      if (!mergedData.tokensObserved && mergedData.tokensActivated) {
        mergedData.tokensObserved = mergedData.tokensActivated;
      }

      const bufferingStatus = isFailed
        ? 'buffering-failed'
        : isActivated
          ? 'activated'
          : isDisconnected
            ? 'disconnected'
            : 'buffering-complete';

      convertedParts.push({
        type: 'dynamic-tool',
        toolCallId: `om-buffering-${cycleId}`,
        toolName: OM_TOOL_NAME,
        input: mergedData,
        output: isLoading
          ? undefined
          : {
              status: bufferingStatus,
              omData: mergedData,
            },
        state: isLoading ? 'input-available' : 'output-available',
      });
    } else if (partType?.startsWith('data-om-')) {
      // Silently skip all other OM parts (end, failed, activation, status).
      // Their data is already in globalOmParts and merged into the start-position badge.
      continue;
    } else {
      // Keep non-OM parts as-is
      convertedParts.push(part);
    }
  }

  return {
    ...message,
    content: {
      ...message.content,
      parts: convertedParts as MastraDBMessage['content']['parts'],
    },
  };
};

// -----------------------------------------------------------------------------
// Reload / interruption helpers for OM badges.
//
// `useChat` returns canonical `MastraDBMessage`s, where parts live at
// `message.content.parts` (and `content` is an object, not an array). These
// helpers therefore read/write `content.parts` directly. They are typed against
// `MastraDBMessage[]` on purpose: the previous in-provider versions were typed
// `any[]` and silently no-oped on the nested shape.
// -----------------------------------------------------------------------------

const mapAssistantParts = (
  messages: MastraDBMessage[],
  mapParts: (parts: any[]) => { parts: any[]; changed: boolean },
): MastraDBMessage[] =>
  messages.map(msg => {
    if (msg.role !== 'assistant') return msg;
    const parts = msg.content?.parts;
    if (!Array.isArray(parts)) return msg;

    const { parts: nextParts, changed } = mapParts(parts as any[]);
    if (!changed) return msg;

    return {
      ...msg,
      content: { ...msg.content, parts: nextParts as MastraDBMessage['content']['parts'] },
    };
  });

/**
 * Mark in-progress OM markers as disconnected when a stream is interrupted
 * (user cancel, network error, process exit). Preserves the original part type so
 * the badge stays anchored, only adding disconnection metadata to the data payload.
 */
export const markOmMarkersAsDisconnected = (messages: MastraDBMessage[]): MastraDBMessage[] =>
  mapAssistantParts(messages, parts => {
    let changed = false;
    const nextParts = parts.map((part: any) => {
      // Raw start markers (keep original type for badge anchoring).
      if (part.type === 'data-om-observation-start' || part.type === 'data-om-buffering-start') {
        changed = true;
        return {
          ...part,
          data: { ...part.data, disconnectedAt: new Date().toISOString(), _state: 'disconnected' },
        };
      }
      // Already-converted tool-call format still in a loading state.
      if (part.type === 'tool-call' && part.toolName === OM_TOOL_NAME) {
        const omData = part.metadata?.omData || part.args;
        if (!omData?.completedAt && !omData?.failedAt && !omData?.disconnectedAt) {
          changed = true;
          return {
            ...part,
            metadata: {
              ...part.metadata,
              omData: { ...omData, disconnectedAt: new Date().toISOString(), _state: 'disconnected' },
            },
          };
        }
      }
      return part;
    });
    return { parts: nextParts, changed };
  });

/**
 * Inject synthetic `data-om-buffering-end` parts after buffer-status resolves so
 * `convertOmPartsInMastraMessage` sees a matching end for each in-progress start.
 * Uses the record from `awaitBufferStatus` to populate token counts/observations.
 */
export const injectBufferingEnds = (messages: MastraDBMessage[], record?: any): MastraDBMessage[] => {
  const chunksByCycleId = new Map<string, any>();
  if (record?.bufferedObservationChunks) {
    for (const chunk of record.bufferedObservationChunks) {
      if (chunk.cycleId) chunksByCycleId.set(chunk.cycleId, chunk);
    }
  }

  return mapAssistantParts(messages, parts => {
    const newParts: any[] = [];
    let changed = false;

    for (const part of parts) {
      newParts.push(part);
      if (part.type === 'data-om-buffering-start' && part.data?.cycleId && !part.data?.disconnectedAt) {
        const cycleId = part.data.cycleId;
        const opType = part.data.operationType;

        const endData: Record<string, any> = {
          cycleId,
          operationType: opType,
          completedAt: new Date().toISOString(),
        };

        if (opType === 'observation') {
          const chunk = chunksByCycleId.get(cycleId);
          if (chunk) {
            endData.tokensBuffered = chunk.messageTokens;
            endData.bufferedTokens = chunk.tokenCount;
            endData.observations = chunk.observations;
          }
        } else if (opType === 'reflection' && record) {
          endData.tokensBuffered = record.bufferedReflectionInputTokens;
          endData.bufferedTokens = record.bufferedReflectionTokens;
          endData.observations = record.bufferedReflection;
        }

        newParts.push({ type: 'data-om-buffering-end', data: endData });
        changed = true;
      }
    }

    return { parts: newParts, changed };
  });
};

/**
 * Scan persisted messages on initial load for OM activation markers and the last
 * progress part, so buffering badges show as activated and token counts are
 * accurate after a reload.
 */
export const scanOmInitialState = (
  messages: MastraDBMessage[],
): { activatedCycleIds: string[]; lastProgress: Record<string, unknown> | null } => {
  const activatedCycleIds: string[] = [];
  let lastProgress: Record<string, unknown> | null = null;

  for (const msg of messages) {
    const parts = msg?.content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts as any[]) {
      if (part?.type === 'data-om-activation' && part?.data?.cycleId) {
        activatedCycleIds.push(part.data.cycleId);
      }
      if (part?.type === 'data-om-status' && part?.data) {
        lastProgress = part.data;
      }
    }
  }

  return { activatedCycleIds, lastProgress };
};
