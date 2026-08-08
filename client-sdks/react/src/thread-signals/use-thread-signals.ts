import type {
  ProcessThreadSignalsOptions,
  ThreadMessageAccepted,
  ThreadMessageHistoryOptions,
  ThreadMessageInput,
  ThreadSignalChunk,
  ThreadSignalRunSnapshot,
  ThreadSignalsClient,
  ThreadSignalsSubscription,
  ThreadToolApprovalAccepted,
  ThreadToolApprovalInput,
} from '@mastra/client-js/thread-signals';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseThreadSignalsOptions<TMessage = unknown> {
  client: ThreadSignalsClient;
  threadId: string;
  resourceId?: string;
  history?: ThreadMessageHistoryOptions | false;
  reconnect?: ProcessThreadSignalsOptions['reconnect'];
  onChunk?: (chunk: ThreadSignalChunk) => void | Promise<void>;
}

type ThreadMessageHookInput = Omit<ThreadMessageInput, 'threadId' | 'resourceId'> &
  Pick<ThreadMessageInput, 'message'>;

export interface UseThreadSignalsResult<TMessage = unknown> {
  snapshot: ThreadSignalRunSnapshot;
  messages: TMessage[];
  chunks: ThreadSignalChunk[];
  isLoadingHistory: boolean;
  error: Error | undefined;
  reloadHistory(): Promise<void>;
  sendMessage(params: ThreadMessageHookInput): Promise<ThreadMessageAccepted>;
  queueMessage(params: ThreadMessageHookInput): Promise<ThreadMessageAccepted>;
  sendToolApproval(
    params: Omit<ThreadToolApprovalInput, 'threadId' | 'resourceId'>,
  ): Promise<ThreadToolApprovalAccepted>;
  abort(): Promise<boolean>;
}

const IDLE_SNAPSHOT: ThreadSignalRunSnapshot = {
  status: 'idle',
  updatedAt: new Date(0).toISOString(),
};
const EMPTY_HISTORY: ThreadMessageHistoryOptions = {};

export function useThreadSignals<TMessage = unknown>(
  options: UseThreadSignalsOptions<TMessage>,
): UseThreadSignalsResult<TMessage> {
  const { client, threadId, resourceId, history = EMPTY_HISTORY, reconnect = true, onChunk } = options;
  const subscriptionRef = useRef<ThreadSignalsSubscription | undefined>(undefined);
  const historyRequestRef = useRef(0);
  const onChunkRef = useRef(onChunk);
  const historyRef = useRef(history);
  const reconnectRef = useRef(reconnect);
  const [snapshot, setSnapshot] = useState<ThreadSignalRunSnapshot>(IDLE_SNAPSHOT);
  const [messages, setMessages] = useState<TMessage[]>([]);
  const [chunks, setChunks] = useState<ThreadSignalChunk[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(history !== false);
  const [error, setError] = useState<Error>();
  onChunkRef.current = onChunk;
  historyRef.current = history;
  reconnectRef.current = reconnect;

  const reloadHistory = useCallback(async () => {
    const requestId = ++historyRequestRef.current;
    const currentHistory = historyRef.current;
    if (currentHistory === false) {
      setIsLoadingHistory(false);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const result = await client.listMessages<TMessage>(threadId, {
        ...currentHistory,
        resourceId: currentHistory.resourceId ?? resourceId,
      });
      if (requestId === historyRequestRef.current) setMessages(result.messages);
    } catch (caught) {
      if (requestId === historyRequestRef.current) {
        setError(caught instanceof Error ? caught : new Error(String(caught)));
      }
    } finally {
      if (requestId === historyRequestRef.current) setIsLoadingHistory(false);
    }
  }, [client, resourceId, threadId]);

  useEffect(() => {
    let mounted = true;
    historyRequestRef.current += 1;
    setSnapshot(IDLE_SNAPSHOT);
    setMessages([]);
    setChunks([]);
    setIsLoadingHistory(historyRef.current !== false);
    setError(undefined);

    void (async () => {
      try {
        const subscription = await client.subscribeToThread({ resourceId, threadId });
        if (!mounted) {
          subscription.unsubscribe();
          return;
        }
        subscriptionRef.current = subscription;
        void subscription
          .processDataStream({
            reconnect: reconnectRef.current,
            onSnapshot: next => {
              if (mounted) setSnapshot(next);
            },
            onChunk: async chunk => {
              if (!mounted) return;
              if (chunk.type !== 'data-thread-state') setChunks(current => [...current, chunk]);
              await onChunkRef.current?.(chunk);
            },
          })
          .catch(caught => {
            if (mounted) setError(caught instanceof Error ? caught : new Error(String(caught)));
          });
        await reloadHistory();
      } catch (caught) {
        if (mounted) setError(caught instanceof Error ? caught : new Error(String(caught)));
      }
    })();

    return () => {
      mounted = false;
      historyRequestRef.current += 1;
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = undefined;
    };
  }, [client, reloadHistory, resourceId, threadId]);

  return {
    snapshot,
    messages,
    chunks,
    isLoadingHistory,
    error,
    reloadHistory,
    sendMessage: params =>
      client.sendMessage({
        ...params,
        threadId,
        ...(resourceId ? { resourceId } : {}),
      }),
    queueMessage: params =>
      client.queueMessage({
        ...params,
        threadId,
        ...(resourceId ? { resourceId } : {}),
      }),
    sendToolApproval: params =>
      client.sendToolApproval({
        ...params,
        threadId,
        ...(resourceId ? { resourceId } : {}),
      }),
    abort: async () => subscriptionRef.current?.abort() ?? false,
  };
}
