import type { MastraMemory } from '../memory/memory';
import type { MemoryConfigInternal, StorageThreadType } from '../memory/types';
import type { MessageList } from './message-list';
import type { MastraDBMessage } from './message-list/state/types';
import { createSignal, mastraDBMessageToSignal } from './signals';
import type { AgentStateSignalInput, CreatedAgentSignal, CreatedStateAgentSignal } from './signals';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type StateSignalTracking = {
  currentCacheKey?: string;
  currentMode?: 'snapshot' | 'delta';
  version?: number;
  lastSignalId?: string;
  lastSnapshotSignalId?: string;
  updatedAt?: string;
  activeCopies?: Array<{ id: string; cacheKey?: string; mode?: 'snapshot' | 'delta'; version?: number }>;
};

export type ActiveStateSignal = CreatedAgentSignal & {
  type: 'state';
  metadata?: Record<string, unknown> & {
    state?: {
      id?: string;
      threadId?: string;
      cacheKey?: string;
      version?: number;
      mode?: 'snapshot' | 'delta';
    };
  };
};

export type StateSignalHistory = {
  activeStateSignals: ActiveStateSignal[];
  contextWindow: {
    hasSnapshot: boolean;
  };
  lastSnapshot?: ActiveStateSignal;
  deltasSinceSnapshot: ActiveStateSignal[];
};

export type ApplyStateSignalResult =
  | { skipped: true; reason: 'unchanged'; stateId: string; tracking?: StateSignalTracking }
  | { skipped: false; signal: CreatedAgentSignal; stateId: string; version: number; tracking: StateSignalTracking };

export function getStateSignalsMetadata(threadMetadata?: Record<string, unknown>): Record<string, StateSignalTracking> {
  if (!threadMetadata) return {};
  const mastra = threadMetadata.mastra;
  if (!isPlainObject(mastra)) return {};
  const stateSignals = mastra.stateSignals;
  return isPlainObject(stateSignals) ? (stateSignals as Record<string, StateSignalTracking>) : {};
}

export function setStateSignalMetadata(
  threadMetadata: Record<string, unknown> | undefined,
  stateId: string,
  tracking: StateSignalTracking,
): Record<string, unknown> {
  const existing = threadMetadata ?? {};
  const existingMastra = isPlainObject(existing.mastra) ? existing.mastra : {};
  const existingStateSignals = isPlainObject(existingMastra.stateSignals) ? existingMastra.stateSignals : {};

  return {
    ...existing,
    mastra: {
      ...existingMastra,
      stateSignals: {
        ...existingStateSignals,
        [stateId]: tracking,
      },
    },
  };
}

function signalCreatedAt(signal: ActiveStateSignal): number {
  const createdAt = signal.createdAt instanceof Date ? signal.createdAt : new Date(signal.createdAt);
  const timestamp = createdAt.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortStateSignals(signals: ActiveStateSignal[]): ActiveStateSignal[] {
  return signals
    .map((signal, index) => ({ signal, index }))
    .sort((left, right) => signalCreatedAt(left.signal) - signalCreatedAt(right.signal) || left.index - right.index)
    .map(({ signal }) => signal);
}

export function dbMessagesToStateSignals(
  messages: MastraDBMessage[],
  stateId: string | undefined,
  threadId: string,
): ActiveStateSignal[] {
  return sortStateSignals(
    messages
      .filter(message => message.role === 'signal')
      .map(message => {
        try {
          return mastraDBMessageToSignal(message);
        } catch {
          return undefined;
        }
      })
      .filter(
        (signal): signal is ActiveStateSignal =>
          signal?.type === 'state' &&
          isPlainObject(signal.metadata?.state) &&
          (!stateId || signal.metadata.state.id === stateId) &&
          signal.metadata.state.threadId === threadId,
      ),
  );
}

export function getActiveStateSignals(
  messageList: MessageList,
  stateId: string | undefined,
  threadId: string,
): ActiveStateSignal[] {
  return dbMessagesToStateSignals(messageList.get.all.db(), stateId, threadId);
}

export function mergeStateSignals(...signalGroups: ActiveStateSignal[][]): ActiveStateSignal[] {
  const signalsById = new Map<string, ActiveStateSignal>();
  for (const signal of signalGroups.flat()) {
    signalsById.set(signal.id, signal);
  }
  return sortStateSignals([...signalsById.values()]);
}

export function deriveStateSignalHistory(activeStateSignals: ActiveStateSignal[]): StateSignalHistory {
  const sortedStateSignals = sortStateSignals(activeStateSignals);
  const lastSnapshotIndex = sortedStateSignals.findLastIndex(signal => signal.metadata?.state?.mode === 'snapshot');
  const lastSnapshot = lastSnapshotIndex >= 0 ? sortedStateSignals[lastSnapshotIndex] : undefined;
  const deltasSinceSnapshot = sortedStateSignals
    .slice(lastSnapshotIndex + 1)
    .filter(signal => signal.metadata?.state?.mode === 'delta');

  return {
    activeStateSignals: sortedStateSignals,
    contextWindow: {
      hasSnapshot: Boolean(lastSnapshot),
    },
    lastSnapshot,
    deltasSinceSnapshot,
  };
}

export async function resolveStateSignalHistory({
  messageList,
  memory,
  threadId,
  stateId,
  tracking,
}: {
  messageList: MessageList;
  memory: MastraMemory;
  threadId: string;
  stateId: string;
  tracking?: StateSignalTracking;
}): Promise<StateSignalHistory> {
  const localStateSignals = getActiveStateSignals(messageList, stateId, threadId);
  const localHistory = deriveStateSignalHistory(localStateSignals);
  const contextWindow = localHistory.contextWindow;

  if (localHistory.contextWindow.hasSnapshot || !tracking?.lastSnapshotSignalId) {
    return { ...localHistory, contextWindow };
  }

  const memoryStore = await memory.storage.getStore('memory');
  if (!memoryStore) return { ...localHistory, contextWindow };

  const trackedSignalIds = new Set<string>();
  for (const activeCopy of tracking.activeCopies ?? []) {
    trackedSignalIds.add(activeCopy.id);
  }
  trackedSignalIds.add(tracking.lastSnapshotSignalId);

  if (trackedSignalIds.size === 0 || typeof memoryStore.listMessagesById !== 'function') {
    return { ...localHistory, contextWindow };
  }

  const storedMessages = await memoryStore.listMessagesById({ messageIds: [...trackedSignalIds] });
  const storedStateSignals = dbMessagesToStateSignals(storedMessages.messages, stateId, threadId);
  const resolvedStateSignals = mergeStateSignals(storedStateSignals, localStateSignals);

  return {
    ...deriveStateSignalHistory(resolvedStateSignals.length > 0 ? resolvedStateSignals : localStateSignals),
    contextWindow,
  };
}

export function createStateSignalInput(
  input: AgentStateSignalInput | (Omit<AgentStateSignalInput, 'id'> & { id?: string }),
  options?: { defaultId?: string; acceptedAt?: Date },
): { stateId: string; signal: CreatedStateAgentSignal; mode: 'snapshot' | 'delta'; cacheKey: string } {
  const stateId = input.id ?? options?.defaultId;
  if (!stateId) {
    throw new Error('state signal id is required');
  }
  if (!input.cacheKey) {
    throw new Error('state signal cacheKey is required');
  }

  const mode = input.mode ?? 'snapshot';
  const { id: _stateId, cacheKey, mode: _mode, value, delta, metadata, ...signalInput } = input;
  const signal = createSignal({
    ...signalInput,
    type: 'state',
    tagName: signalInput.tagName ?? 'state',
    acceptedAt: options?.acceptedAt,
    metadata: {
      ...metadata,
      state: {
        ...(isPlainObject(metadata?.state) ? metadata.state : {}),
        id: stateId,
        cacheKey,
        mode,
      },
      ...(value !== undefined ? { value } : {}),
      ...(delta !== undefined ? { delta } : {}),
    },
  });

  return { stateId, signal, mode, cacheKey };
}

export async function applyStateSignal({
  input,
  memory,
  thread,
  resourceId,
  threadId,
  memoryConfig,
  messageList,
  activeStateSignals,
  defaultId,
  acceptedAt,
  beforeAddSignal,
  writeSignal,
}: {
  input: AgentStateSignalInput | (Omit<AgentStateSignalInput, 'id'> & { id?: string });
  memory: MastraMemory;
  thread: StorageThreadType;
  resourceId: string;
  threadId: string;
  memoryConfig?: MemoryConfigInternal;
  messageList?: MessageList;
  activeStateSignals?: ActiveStateSignal[];
  defaultId?: string;
  acceptedAt?: Date;
  beforeAddSignal?: () => void;
  writeSignal?: (signal: CreatedAgentSignal) => Promise<void> | void;
}): Promise<ApplyStateSignalResult> {
  const { stateId, signal, cacheKey, mode } = createStateSignalInput(input, { defaultId, acceptedAt });
  const activeSignals =
    activeStateSignals ?? (messageList ? getActiveStateSignals(messageList, stateId, threadId) : []);
  const tracking = getStateSignalsMetadata(thread.metadata)[stateId];

  const usesActiveWindow = Boolean(messageList || activeStateSignals);
  const hasActiveCopy = activeSignals.some(
    signal => signal.metadata?.state?.cacheKey === cacheKey && signal.metadata?.state?.mode === mode,
  );
  const matchesCurrentState =
    tracking?.currentCacheKey === cacheKey &&
    (tracking.currentMode === mode || (!tracking.currentMode && hasActiveCopy));
  if (matchesCurrentState && (!usesActiveWindow || hasActiveCopy)) {
    return { skipped: true, reason: 'unchanged', stateId, tracking };
  }

  const previousVersion = typeof tracking?.version === 'number' ? tracking.version : 0;
  const version = matchesCurrentState ? previousVersion || 1 : previousVersion + 1;
  const updatedSignal = createSignal({
    ...signal,
    type: 'state',
    metadata: {
      ...signal.metadata,
      state: {
        ...(isPlainObject(signal.metadata?.state) ? signal.metadata.state : {}),
        id: stateId,
        threadId,
        cacheKey,
        version,
        mode,
      },
    },
  });

  beforeAddSignal?.();
  if (messageList) {
    messageList.addSignal(updatedSignal);
  }
  await writeSignal?.(updatedSignal);

  const updatedAt = new Date().toISOString();
  const updatedActiveSignals = [...activeSignals, updatedSignal];
  const nextTracking: StateSignalTracking = {
    currentCacheKey: cacheKey,
    currentMode: mode,
    version,
    lastSignalId: updatedSignal.id,
    lastSnapshotSignalId: mode === 'snapshot' ? updatedSignal.id : tracking?.lastSnapshotSignalId,
    updatedAt,
    activeCopies: updatedActiveSignals.map(activeSignal => {
      const activeStateMetadata = isPlainObject(activeSignal.metadata?.state) ? activeSignal.metadata.state : {};
      return {
        id: activeSignal.id,
        ...(typeof activeStateMetadata.cacheKey === 'string' ? { cacheKey: activeStateMetadata.cacheKey } : {}),
        ...(activeStateMetadata.mode === 'snapshot' || activeStateMetadata.mode === 'delta'
          ? { mode: activeStateMetadata.mode }
          : {}),
        ...(typeof activeStateMetadata.version === 'number' ? { version: activeStateMetadata.version } : {}),
      };
    }),
  };

  await memory.saveThread({
    thread: {
      ...thread,
      id: threadId,
      resourceId: thread.resourceId ?? resourceId,
      createdAt: thread.createdAt ?? new Date(),
      updatedAt: new Date(updatedAt),
      metadata: setStateSignalMetadata(thread.metadata, stateId, nextTracking),
    },
    memoryConfig,
  });

  return { skipped: false, signal: updatedSignal, stateId, version, tracking: nextTracking };
}
