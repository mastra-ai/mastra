import type { MastraDBMessage } from '@mastra/core/agent/message-list';

import type { OmCycleParts, OmCycleViewModel, OmIndexablePart } from './om-types';

/**
 * Converts a data-om-* part to dynamic-tool format so toAssistantUIMessage can transform it.
 * The ToolFallback component will detect the om-observation-* prefix and render ObservationMarkerBadge.
 *
 * Input: { type: 'data-om-observation-start', data: {...} }
 * Output: { type: 'dynamic-tool', toolCallId, toolName: 'om-observation-start', input: {...}, output: {...}, state: 'output-available' }
 */
const OM_TOOL_NAME = 'mastra-memory-om-observation';

const OM_TYPE_TO_KEY = {
  'data-om-observation-start': 'start',
  'data-om-observation-end': 'end',
  'data-om-observation-failed': 'failed',
  'data-om-buffering-start': 'bufferingStart',
  'data-om-buffering-end': 'bufferingEnd',
  'data-om-buffering-failed': 'bufferingFailed',
  'data-om-activation': 'activation',
} as const satisfies Record<string, keyof OmCycleParts>;

/**
 * Index data-om-* parts by cycleId from an array of parts.
 * Merges into an existing map so it can be called across multiple messages.
 */
const indexOmPartsByCycleId = (parts: MastraDBMessage['content']['parts'], target: Map<string, OmCycleParts>) => {
  for (const part of parts) {
    if (!(part.type in OM_TYPE_TO_KEY)) continue;
    const omPart = part as NonNullable<OmIndexablePart>;
    const cycleId = omPart.data?.cycleId;
    if (!cycleId) continue;

    const key = OM_TYPE_TO_KEY[omPart.type];
    const existing = target.get(cycleId) || {};
    // The discriminant `omPart.type` and `key` are paired in OM_TYPE_TO_KEY, so
    // the assignment is sound; TS cannot correlate the two unions on its own.
    (existing[key] as OmIndexablePart) = omPart;
    target.set(cycleId, existing);
  }
  return target;
};

/**
 * Build a global map of all OM cycle parts across all messages.
 * This gives each per-message converter the full picture of a cycle's state
 * (e.g., buffering-start on message A, activation on message B).
 */
export type OmTerminalExtractionCache = Map<
  string,
  Partial<
    Record<
      'end' | 'failed' | 'bufferingEnd' | 'bufferingFailed',
      { extractedValues?: Record<string, unknown>; extractionFailures?: Array<{ slug: string; error: string }> }
    >
  >
>;

const hasExtractedValues = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;

const hasExtractionFailures = (value: unknown): value is Array<{ slug: string; error: string }> =>
  Array.isArray(value) && value.length > 0;

const getExtractionData = (data: any) => ({
  ...(hasExtractedValues(data?.extractedValues) ? { extractedValues: data.extractedValues } : {}),
  ...(hasExtractionFailures(data?.extractionFailures) ? { extractionFailures: data.extractionFailures } : {}),
});

const hasExtractionData = (data: any) => Object.keys(getExtractionData(data)).length > 0;

const mergeCachedExtractionData = (part: OmIndexablePart | undefined, cachedData: any) => {
  if (!part?.data || !cachedData) return part;

  const currentExtractionData = getExtractionData(part.data);
  const cachedExtractionData = getExtractionData(cachedData);
  if (!Object.keys(cachedExtractionData).length) return part;

  const mergedExtractionData = {
    ...((currentExtractionData.extractedValues ?? cachedExtractionData.extractedValues)
      ? { extractedValues: currentExtractionData.extractedValues ?? cachedExtractionData.extractedValues }
      : {}),
    ...((currentExtractionData.extractionFailures ?? cachedExtractionData.extractionFailures)
      ? { extractionFailures: currentExtractionData.extractionFailures ?? cachedExtractionData.extractionFailures }
      : {}),
  };

  return {
    ...part,
    data: {
      ...part.data,
      ...mergedExtractionData,
    },
  } as OmIndexablePart;
};

export const retainOmTerminalExtractionData = (
  globalOmParts: Map<string, OmCycleParts>,
  cache: OmTerminalExtractionCache,
) => {
  for (const [cycleId, cycle] of globalOmParts) {
    const cached = cache.get(cycleId);
    if (cached) {
      cycle.end = mergeCachedExtractionData(cycle.end, cached.end) as typeof cycle.end;
      cycle.failed = mergeCachedExtractionData(cycle.failed, cached.failed) as typeof cycle.failed;
      cycle.bufferingEnd = mergeCachedExtractionData(
        cycle.bufferingEnd,
        cached.bufferingEnd,
      ) as typeof cycle.bufferingEnd;
      cycle.bufferingFailed = mergeCachedExtractionData(
        cycle.bufferingFailed,
        cached.bufferingFailed,
      ) as typeof cycle.bufferingFailed;
    }

    const nextCached = { ...(cached ?? {}) };
    if (hasExtractionData(cycle.end?.data)) nextCached.end = getExtractionData(cycle.end?.data);
    if (hasExtractionData(cycle.failed?.data)) nextCached.failed = getExtractionData(cycle.failed?.data);
    if (hasExtractionData(cycle.bufferingEnd?.data))
      nextCached.bufferingEnd = getExtractionData(cycle.bufferingEnd?.data);
    if (hasExtractionData(cycle.bufferingFailed?.data)) {
      nextCached.bufferingFailed = getExtractionData(cycle.bufferingFailed?.data);
    }

    if (Object.keys(nextCached).length > 0) {
      cache.set(cycleId, nextCached);
    }
  }

  return globalOmParts;
};

export const buildGlobalOmPartsByCycleId = (
  messages: MastraDBMessage[],
  extractionCache?: OmTerminalExtractionCache,
) => {
  const map = new Map<string, OmCycleParts>();
  for (const msg of messages) {
    const parts = msg?.content?.parts;
    if (!Array.isArray(parts)) continue;
    indexOmPartsByCycleId(parts, map);
  }
  return extractionCache ? retainOmTerminalExtractionData(map, extractionCache) : map;
};

const normalizeObservationCycle = (cycleId: string, cycle: OmCycleParts): OmCycleViewModel | undefined => {
  const startData = cycle.start?.data;
  if (!startData) return undefined;

  const endData = cycle.end?.data;
  const failedData = cycle.failed?.data;
  const isFailed = !!cycle.failed;
  const isComplete = !!cycle.end;
  const isDisconnected = !!startData.disconnectedAt || (isComplete && !!endData?.disconnectedAt);
  const status = isFailed ? 'failed' : isDisconnected ? 'disconnected' : isComplete ? 'observed' : 'observing';
  const omData = {
    ...startData,
    ...(isComplete ? endData : {}),
    ...(isFailed ? failedData : {}),
    _state: isFailed ? 'failed' : isDisconnected ? 'disconnected' : isComplete ? 'complete' : 'loading',
  };

  return {
    cycleId,
    recordId: typeof omData.recordId === 'string' ? omData.recordId : undefined,
    status,
    operationType: omData.operationType,
    observations: omData.observations,
    extractedValues: hasExtractedValues(omData.extractedValues) ? omData.extractedValues : undefined,
    extractionFailures: hasExtractionFailures(omData.extractionFailures) ? omData.extractionFailures : undefined,
    omData,
    isLoading: status === 'observing',
  };
};

const normalizeBufferingCycle = (cycleId: string, cycle: OmCycleParts): OmCycleViewModel | undefined => {
  const startData = cycle.bufferingStart?.data;
  if (!startData) return undefined;

  const endData = cycle.bufferingEnd?.data;
  const failedData = cycle.bufferingFailed?.data;
  const activationData = cycle.activation?.data;
  const isFailed = !!cycle.bufferingFailed;
  const isActivated = !!cycle.activation;
  const isComplete = !!cycle.bufferingEnd;
  const isDisconnected = !!startData.disconnectedAt;
  const status = isFailed
    ? 'buffering-failed'
    : isDisconnected
      ? 'disconnected'
      : isComplete
        ? 'buffering-complete'
        : isActivated
          ? 'activated'
          : 'buffering';
  const omData: Record<string, unknown> = {
    ...startData,
    ...(isComplete ? endData : {}),
    ...(isFailed ? failedData : {}),
    ...(isActivated ? activationData : {}),
    _state: status,
  };

  if (!omData.tokensObserved && omData.tokensActivated) {
    omData.tokensObserved = omData.tokensActivated;
  }

  return {
    cycleId,
    recordId: typeof omData.recordId === 'string' ? omData.recordId : undefined,
    status,
    operationType: omData.operationType,
    observations: omData.observations,
    extractedValues: hasExtractedValues(omData.extractedValues) ? omData.extractedValues : undefined,
    extractionFailures: hasExtractionFailures(omData.extractionFailures) ? omData.extractionFailures : undefined,
    omData,
    isLoading: status === 'buffering',
  };
};

export const normalizeOmCycle = (
  cycleId: string,
  cycle: OmCycleParts,
  type: 'observation' | 'buffering',
): OmCycleViewModel | undefined =>
  type === 'observation' ? normalizeObservationCycle(cycleId, cycle) : normalizeBufferingCycle(cycleId, cycle);

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
const toDynamicOmToolPart = (cycleId: string, type: 'observation' | 'buffering', viewModel: OmCycleViewModel) => ({
  type: 'dynamic-tool',
  toolCallId: `om-${type}-${cycleId}`,
  toolName: OM_TOOL_NAME,
  input: viewModel.omData,
  output: viewModel.isLoading
    ? undefined
    : {
        status:
          type === 'observation'
            ? viewModel.status === 'failed'
              ? 'failed'
              : viewModel.status === 'disconnected'
                ? 'disconnected'
                : 'complete'
            : viewModel.status,
        omData: viewModel.omData,
      },
  state: viewModel.isLoading ? 'input-available' : 'output-available',
});

const hasTerminalPart = (cycle: OmCycleParts | undefined, type: 'observation' | 'buffering') =>
  type === 'observation' ? !!cycle?.end || !!cycle?.failed : !!cycle?.bufferingEnd || !!cycle?.bufferingFailed;

const isTerminalPartForType = (partType: string, type: 'observation' | 'buffering') =>
  type === 'observation'
    ? partType === 'data-om-observation-end' || partType === 'data-om-observation-failed'
    : partType === 'data-om-buffering-end' ||
      partType === 'data-om-buffering-failed' ||
      partType === 'data-om-activation';

export const convertOmPartsInMastraMessage = (
  message: MastraDBMessage,
  globalOmParts: Map<string, OmCycleParts>,
): MastraDBMessage => {
  if (!message || !Array.isArray(message.content?.parts)) {
    return message;
  }

  const messageOmParts = indexOmPartsByCycleId(message.content.parts, new Map<string, OmCycleParts>());
  const convertedParts: any[] = [];

  for (const part of message.content.parts) {
    const cycleId = (part as any).data?.cycleId;
    const partType = part.type as string;

    if (partType === 'data-om-observation-start' && cycleId) {
      const messageCycle = messageOmParts.get(cycleId);
      const globalCycle = globalOmParts.get(cycleId);
      if (!messageCycle) continue;
      const cycle = hasTerminalPart(globalCycle, 'observation')
        ? (globalCycle ?? messageCycle)
        : { start: messageCycle.start };
      const viewModel = normalizeOmCycle(cycleId, cycle, 'observation');
      if (!viewModel) continue;
      convertedParts.push(toDynamicOmToolPart(cycleId, 'observation', viewModel));
    } else if (partType === 'data-om-buffering-start' && cycleId) {
      const messageCycle = messageOmParts.get(cycleId);
      const globalCycle = globalOmParts.get(cycleId);
      if (!messageCycle) continue;
      const cycle = hasTerminalPart(globalCycle, 'buffering')
        ? (globalCycle ?? messageCycle)
        : { bufferingStart: messageCycle.bufferingStart };
      const viewModel = normalizeOmCycle(cycleId, cycle, 'buffering');
      if (!viewModel) continue;
      convertedParts.push(toDynamicOmToolPart(cycleId, 'buffering', viewModel));
    } else if (cycleId && isTerminalPartForType(partType, 'observation')) {
      const messageCycle = messageOmParts.get(cycleId);
      const cycle = globalOmParts.get(cycleId);
      if (messageCycle?.start || cycle?.start) continue;
      if (!cycle) continue;
      const viewModel = normalizeOmCycle(cycleId, cycle, 'observation');
      if (!viewModel) continue;
      convertedParts.push(toDynamicOmToolPart(cycleId, 'observation', viewModel));
    } else if (cycleId && isTerminalPartForType(partType, 'buffering')) {
      const messageCycle = messageOmParts.get(cycleId);
      const cycle = globalOmParts.get(cycleId);
      if (messageCycle?.bufferingStart || cycle?.bufferingStart) continue;
      if (partType === 'data-om-activation' && (messageCycle?.bufferingEnd || messageCycle?.bufferingFailed)) continue;
      if (!cycle) continue;
      const viewModel = normalizeOmCycle(cycleId, cycle, 'buffering');
      if (!viewModel) continue;
      convertedParts.push(toDynamicOmToolPart(cycleId, 'buffering', viewModel));
    } else if (partType?.startsWith('data-om-')) {
      continue;
    } else {
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

const collectTerminalCycleIds = (messages: MastraDBMessage[]) => {
  const observation = new Set<string>();
  const buffering = new Set<string>();
  const activatedBuffering = new Set<string>();

  for (const msg of messages) {
    const parts = msg.content?.parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts as any[]) {
      const cycleId = part?.data?.cycleId;
      if (!cycleId) continue;

      if (part.type === 'data-om-observation-end' || part.type === 'data-om-observation-failed') {
        observation.add(cycleId);
      }

      if (part.type === 'data-om-buffering-end' || part.type === 'data-om-buffering-failed') {
        buffering.add(cycleId);
      }

      if (part.type === 'data-om-activation') {
        activatedBuffering.add(cycleId);
      }
    }
  }

  return { observation, buffering, activatedBuffering };
};

/**
 * Mark in-progress OM markers as disconnected when a stream is interrupted
 * (user cancel, network error, process exit). Preserves the original part type so
 * the badge stays anchored, only adding disconnection metadata to the data payload.
 */
export const markOmMarkersAsDisconnected = (messages: MastraDBMessage[]): MastraDBMessage[] => {
  const terminalCycleIds = collectTerminalCycleIds(messages);
  const disconnectedBufferingCycleIds = new Set([
    ...terminalCycleIds.buffering,
    ...terminalCycleIds.activatedBuffering,
  ]);

  return mapAssistantParts(messages, parts => {
    let changed = false;
    const nextParts = parts.map((part: any) => {
      // Raw start markers (keep original type for badge anchoring).
      if (part.type === 'data-om-observation-start') {
        const cycleId = part.data?.cycleId;
        if (!cycleId || part.data?.disconnectedAt || terminalCycleIds.observation.has(cycleId)) return part;

        changed = true;
        return {
          ...part,
          data: { ...part.data, disconnectedAt: new Date().toISOString(), _state: 'disconnected' },
        };
      }

      if (part.type === 'data-om-buffering-start') {
        const cycleId = part.data?.cycleId;
        if (!cycleId || part.data?.disconnectedAt || disconnectedBufferingCycleIds.has(cycleId)) return part;

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
};

/**
 * Inject synthetic `data-om-buffering-end` parts after buffer-status resolves so
 * `convertOmPartsInMastraMessage` sees a matching end for each in-progress start.
 * Uses the record from `awaitBufferStatus` to populate token counts/observations.
 */
export const hasInProgressBufferingMarkers = (messages: MastraDBMessage[]) => {
  const { buffering, activatedBuffering } = collectTerminalCycleIds(messages);
  const terminalCycleIds = new Set([...buffering, ...activatedBuffering]);

  for (const msg of messages) {
    const parts = msg.content?.parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts as any[]) {
      const cycleId = part?.data?.cycleId;
      if (
        part.type === 'data-om-buffering-start' &&
        cycleId &&
        !part.data?.disconnectedAt &&
        !terminalCycleIds.has(cycleId)
      ) {
        return true;
      }

      if (
        part.type === 'data-om-buffering-end' &&
        cycleId &&
        part.data?.operationType === 'observation' &&
        !hasExtractionData(part.data)
      ) {
        return true;
      }
    }
  }

  return false;
};

export const injectBufferingEnds = (messages: MastraDBMessage[], record?: any): MastraDBMessage[] => {
  const chunksByCycleId = new Map<string, any>();
  const terminalCycleIds = collectTerminalCycleIds(messages).buffering;

  if (record?.bufferedObservationChunks) {
    for (const chunk of record.bufferedObservationChunks) {
      if (chunk.cycleId) chunksByCycleId.set(chunk.cycleId, chunk);
    }
  }

  return mapAssistantParts(messages, parts => {
    const newParts: any[] = [];
    let changed = false;

    for (const part of parts) {
      if (part.type === 'data-om-buffering-end' && part.data?.cycleId && part.data?.operationType === 'observation') {
        const chunk = chunksByCycleId.get(part.data.cycleId);
        if (chunk && !hasExtractionData(part.data)) {
          newParts.push({
            ...part,
            data: {
              ...part.data,
              observations: part.data.observations ?? chunk.observations,
              extractedValues: chunk.extractedValues,
              extractionFailures: chunk.extractionFailures,
            },
          });
          changed = true;
          continue;
        }
      }

      newParts.push(part);
      if (
        part.type === 'data-om-buffering-start' &&
        part.data?.cycleId &&
        !part.data?.disconnectedAt &&
        !terminalCycleIds.has(part.data.cycleId)
      ) {
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
            endData.extractedValues = chunk.extractedValues;
            endData.extractionFailures = chunk.extractionFailures;
          }
        } else if (opType === 'reflection' && record) {
          endData.tokensBuffered = record.bufferedReflectionInputTokens;
          endData.bufferedTokens = record.bufferedReflectionTokens;
          endData.observations = record.bufferedReflection;
        }

        newParts.push({ type: 'data-om-buffering-end', data: endData });
        terminalCycleIds.add(cycleId);
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
