import type { UIMessage } from '@ai-sdk/react';
import { v4 as uuid } from '@lukeed/uuid';
import { MastraClient } from '@mastra/client-js';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { CoreUserMessage } from '@mastra/core/llm';
import type { TracingOptions } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import type { ChunkType, NetworkChunkType } from '@mastra/core/stream';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MastraUIMessage } from '../lib/ai-sdk';
import { extractRunIdFromMessages } from './extractRunIdFromMessages';
import type { ModelSettings } from './types';
import { toUIMessage } from '@/lib/ai-sdk';
import { resolveInitialMessages } from '@/lib/ai-sdk/memory/resolveInitialMessages';
import { AISdkNetworkTransformer } from '@/lib/ai-sdk/transformers/AISdkNetworkTransformer';
import { fromCoreUserMessageToUIMessage } from '@/lib/ai-sdk/utils/fromCoreUserMessageToUIMessage';
import { useMastraClient } from '@/mastra-client-context';

export interface MastraChatProps {
  agentId: string;
  resourceId?: string;
  initialMessages?: MastraUIMessage[];
  /** Persistent request context used for tool approval/decline calls (e.g. agentVersionId). */
  requestContext?: RequestContext;
}

interface SharedArgs {
  coreUserMessages: CoreUserMessage[];
  requestContext?: RequestContext;
  threadId?: string;
  modelSettings?: ModelSettings;
  signal?: AbortSignal;
  tracingOptions?: TracingOptions;
}

export type SendMessageArgs = { message: string; coreUserMessages?: CoreUserMessage[] } & (
  | ({ mode: 'generate' } & Omit<GenerateArgs, 'coreUserMessages'>)
  | ({ mode: 'stream' } & Omit<StreamArgs, 'coreUserMessages'>)
  | ({ mode: 'network' } & Omit<NetworkArgs, 'coreUserMessages'>)
  | ({ mode?: undefined } & Omit<StreamArgs, 'coreUserMessages'>)
);

export type GenerateArgs = SharedArgs & { onFinish?: (messages: UIMessage[]) => Promise<void> };

export type StreamArgs = SharedArgs & {
  onChunk?: (chunk: ChunkType) => Promise<void>;
  signalId?: string;
};

export type NetworkArgs = SharedArgs & {
  onNetworkChunk?: (chunk: NetworkChunkType) => Promise<void>;
};

export const useChat = ({
  agentId,
  resourceId,
  initialMessages,
  requestContext: propsRequestContext,
}: MastraChatProps) => {
  const _currentRunId = useRef<string | undefined>(undefined);
  const _onChunk = useRef<((chunk: ChunkType) => Promise<void>) | undefined>(undefined);
  const _networkRunId = useRef<string | undefined>(undefined);
  const _onNetworkChunk = useRef<((chunk: NetworkChunkType) => Promise<void>) | undefined>(undefined);
  const _requestContext = useRef<RequestContext | undefined>(propsRequestContext);
  // Tracks the active streamUntilIdle request so a subsequent stream() call can
  // abort the previous one. Without this, a still-open prior stream keeps its
  // background-task pubsub subscription alive and fans events into a second
  // concurrent UI consumer, producing duplicate bg-task events and duplicate
  // continuation turns on the server.
  const _streamAbortRef = useRef<AbortController | null>(null);
  const _threadSubscriptionAbortRef = useRef<AbortController | null>(null);
  const _threadSubscriptionKeyRef = useRef<string | undefined>(undefined);
  const _threadSubscriptionPromiseRef = useRef<Promise<void> | null>(null);
  const [messages, setMessages] = useState<MastraUIMessage[]>([]);
  const [toolCallApprovals, setToolCallApprovals] = useState<{
    [toolCallId: string]: { status: 'approved' | 'declined' };
  }>({});
  const [networkToolCallApprovals, setNetworkToolCallApprovals] = useState<{
    [toolName: string]: { status: 'approved' | 'declined' };
  }>({});

  const baseClient = useMastraClient();
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const formattedMessages = resolveInitialMessages(initialMessages || []);
    setMessages(formattedMessages);
    _currentRunId.current = extractRunIdFromMessages(formattedMessages);
  }, [initialMessages]);

  useEffect(() => {
    _requestContext.current = propsRequestContext;
  }, [propsRequestContext]);

  const getSignalContents = (coreUserMessages: CoreUserMessage[]): MessageListInput => {
    if (coreUserMessages.length === 1) {
      return coreUserMessages[0] as MessageListInput;
    }

    return coreUserMessages as MessageListInput;
  };

  const closeThreadSubscription = useCallback(() => {
    _threadSubscriptionAbortRef.current?.abort();
    _threadSubscriptionAbortRef.current = null;
    _threadSubscriptionKeyRef.current = undefined;
    _threadSubscriptionPromiseRef.current = null;
  }, []);

  useEffect(() => closeThreadSubscription, [agentId, resourceId, closeThreadSubscription]);

  const processStreamChunk = async (chunk: ChunkType, onChunk?: (chunk: ChunkType) => Promise<void>) => {
    setMessages(prev => toUIMessage({ chunk, conversation: prev, metadata: { mode: 'stream' } }));

    if (chunk.type === 'start') {
      setIsRunning(true);
      if ('runId' in chunk && typeof chunk.runId === 'string') {
        _currentRunId.current = chunk.runId;
      }
    }

    if (chunk.type === 'finish' || chunk.type === 'abort' || chunk.type === 'error') {
      setIsRunning(false);
    }

    void (onChunk ?? _onChunk.current)?.(chunk);
  };

  const ensureThreadSubscription = async ({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }) => {
    const subscriptionKey = `${agentId}:${resourceId ?? ''}:${threadId}`;
    if (_threadSubscriptionKeyRef.current === subscriptionKey && _threadSubscriptionPromiseRef.current) {
      await _threadSubscriptionPromiseRef.current;
      return;
    }

    _threadSubscriptionAbortRef.current?.abort();
    const subscriptionAbort = new AbortController();
    _threadSubscriptionAbortRef.current = subscriptionAbort;
    _threadSubscriptionKeyRef.current = subscriptionKey;

    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: subscriptionAbort.signal,
    });
    const subscriptionAgent = clientWithAbort.getAgent(agentId);

    _threadSubscriptionPromiseRef.current = subscriptionAgent
      .subscribeToThread({ resourceId, threadId })
      .then(response => {
        void response
          .processDataStream({
            onChunk: chunk => processStreamChunk(chunk),
          })
          .catch(error => {
            if ((error as { name?: string }).name !== 'AbortError') {
              console.error('[useChat] Thread subscription failed', error);
              setIsRunning(false);
            }
          })
          .finally(() => {
            if (_threadSubscriptionAbortRef.current === subscriptionAbort) {
              _threadSubscriptionAbortRef.current = null;
              _threadSubscriptionKeyRef.current = undefined;
              _threadSubscriptionPromiseRef.current = null;
            }
          });
      })
      .catch(error => {
        if ((error as { name?: string }).name !== 'AbortError') {
          console.error('[useChat] Thread subscription failed', error);
          setIsRunning(false);
        }
        throw error;
      });

    await _threadSubscriptionPromiseRef.current;
  };

  const generate = async ({
    coreUserMessages,
    requestContext,
    threadId,
    modelSettings,
    signal,
    onFinish,
    tracingOptions,
  }: GenerateArgs) => {
    const {
      frequencyPenalty,
      presencePenalty,
      maxRetries,
      maxTokens,
      temperature,
      topK,
      topP,
      instructions,
      providerOptions,
      maxSteps,
      requireToolApproval,
    } = modelSettings || {};
    const resolvedRequestContext = requestContext ?? propsRequestContext;
    _requestContext.current = resolvedRequestContext;
    setIsRunning(true);

    // Create a new client instance with the abort signal
    // We can't use useMastraClient hook here, so we'll create the client directly
    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

    const runId = uuid();
    _currentRunId.current = runId;

    const response = await agent.generate(coreUserMessages, {
      runId,
      maxSteps,
      modelSettings: {
        frequencyPenalty,
        presencePenalty,
        maxRetries,
        maxOutputTokens: maxTokens,
        temperature,
        topK,
        topP,
      },
      instructions,
      requestContext: resolvedRequestContext,
      ...(threadId ? { memory: { thread: threadId, resource: resourceId || agentId } } : {}),
      providerOptions: providerOptions as any,
      tracingOptions,
      requireToolApproval,
    });

    // Check if suspended for tool approval
    if (response.finishReason === 'suspended' && response.suspendPayload) {
      const { toolCallId, toolName, args } = response.suspendPayload;

      // Add uiMessages with requireApprovalMetadata so UI shows approval buttons
      if (response.response?.uiMessages) {
        const mastraUIMessages: MastraUIMessage[] = (response.response.uiMessages || []).map((message: any) => ({
          ...message,
          metadata: {
            mode: 'generate',
            requireApprovalMetadata: {
              [toolName]: {
                toolCallId,
                toolName,
                args,
              },
            },
          },
        }));

        setMessages(prev => [...prev, ...mastraUIMessages]);
      }

      // Set isRunning to false so approval buttons are enabled
      // The approval/decline functions will set isRunning to true when clicked
      setIsRunning(false);
      return;
    }

    setIsRunning(false);

    if (response && 'uiMessages' in response.response && response.response.uiMessages) {
      void onFinish?.(response.response.uiMessages);
      const mastraUIMessages: MastraUIMessage[] = (response.response.uiMessages || []).map(message => ({
        ...message,
        metadata: {
          mode: 'generate',
        },
      }));

      setMessages(prev => [...prev, ...mastraUIMessages]);
    }
  };

  const stream = async ({
    coreUserMessages,
    requestContext,
    threadId,
    onChunk,
    modelSettings,
    signal,
    tracingOptions,
    signalId,
  }: StreamArgs) => {
    const {
      frequencyPenalty,
      presencePenalty,
      maxRetries,
      maxTokens,
      temperature,
      topK,
      topP,
      instructions,
      providerOptions,
      maxSteps,
      requireToolApproval,
    } = modelSettings || {};

    const resolvedRequestContext = requestContext ?? propsRequestContext;
    _requestContext.current = resolvedRequestContext;
    setIsRunning(true);

    _streamAbortRef.current?.abort();
    const internalAbort = new AbortController();
    _streamAbortRef.current = internalAbort;

    if (signal) {
      if (signal.aborted) internalAbort.abort();
      else signal.addEventListener('abort', () => internalAbort.abort(), { once: true });
    }

    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: internalAbort.signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

    if (!threadId) {
      const runId = uuid();
      const response = await agent.streamUntilIdle(coreUserMessages, {
        runId,
        maxSteps,
        modelSettings: {
          frequencyPenalty,
          presencePenalty,
          maxRetries,
          maxOutputTokens: maxTokens,
          temperature,
          topK,
          topP,
        },
        instructions,
        requestContext: resolvedRequestContext,
        providerOptions: providerOptions as any,
        requireToolApproval,
        tracingOptions,
      });

      _onChunk.current = onChunk;
      _currentRunId.current = runId;

      await response.processDataStream({
        onChunk: chunk => processStreamChunk(chunk, onChunk),
      });

      if (_streamAbortRef.current === internalAbort) {
        _streamAbortRef.current = null;
      }
      setIsRunning(false);
      return;
    }

    _onChunk.current = onChunk;

    await ensureThreadSubscription({ threadId, resourceId: resourceId || agentId });

    await agent.sendSignal({
      signal: {
        id: signalId ?? uuid(),
        type: 'user-message',
        contents: getSignalContents(coreUserMessages),
      },
      resourceId: resourceId || agentId,
      threadId,
      streamOptions: {
        maxSteps,
        modelSettings: {
          frequencyPenalty,
          presencePenalty,
          maxRetries,
          maxOutputTokens: maxTokens,
          temperature,
          topK,
          topP,
        },
        instructions,
        requestContext: resolvedRequestContext,
        providerOptions: providerOptions as any,
        requireToolApproval,
        tracingOptions,
      },
    });

    if (_streamAbortRef.current === internalAbort) {
      _streamAbortRef.current = null;
    }
  };

  const network = async ({
    coreUserMessages,
    requestContext,
    threadId,
    onNetworkChunk,
    modelSettings,
    signal,
    tracingOptions,
  }: NetworkArgs) => {
    const { frequencyPenalty, presencePenalty, maxRetries, maxTokens, temperature, topK, topP, maxSteps } =
      modelSettings || {};

    const resolvedRequestContext = requestContext ?? propsRequestContext;
    _requestContext.current = resolvedRequestContext;
    setIsRunning(true);

    // Create a new client instance with the abort signal
    // We can't use useMastraClient hook here, so we'll create the client directly
    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

    const runId = uuid();

    const response = await agent.network(coreUserMessages, {
      maxSteps,
      modelSettings: {
        frequencyPenalty,
        presencePenalty,
        maxRetries,
        maxOutputTokens: maxTokens,
        temperature,
        topK,
        topP,
      },
      runId,
      requestContext: resolvedRequestContext,
      ...(threadId ? { memory: { thread: threadId, resource: resourceId || agentId } } : {}),
      tracingOptions,
    });

    _onNetworkChunk.current = onNetworkChunk;
    _networkRunId.current = runId;

    const transformer = new AISdkNetworkTransformer();

    await response.processDataStream({
      onChunk: async (chunk: NetworkChunkType) => {
        setMessages(prev => transformer.transform({ chunk, conversation: prev, metadata: { mode: 'network' } }));
        void onNetworkChunk?.(chunk);
      },
    });

    setIsRunning(false);
  };

  const handleCancelRun = () => {
    _streamAbortRef.current?.abort();
    _streamAbortRef.current = null;
    closeThreadSubscription();
    setIsRunning(false);
    _currentRunId.current = undefined;
    _onChunk.current = undefined;
    _networkRunId.current = undefined;
    _onNetworkChunk.current = undefined;
    _requestContext.current = undefined;
  };

  const approveToolCall = async (toolCallId: string) => {
    const onChunk = _onChunk.current;
    const currentRunId = _currentRunId.current;

    if (!currentRunId)
      return console.info('[approveToolCall] approveToolCall can only be called after a stream has started');

    setIsRunning(true);
    setToolCallApprovals(prev => ({ ...prev, [toolCallId]: { status: 'approved' } }));

    const agent = baseClient.getAgent(agentId);
    const response = await agent.approveToolCall({
      runId: currentRunId,
      toolCallId,
      requestContext: _requestContext.current,
    });

    if (_threadSubscriptionKeyRef.current) {
      return;
    }

    await response.processDataStream({
      onChunk: async (chunk: ChunkType) => {
        // Without this, React might batch intermediate chunks which would break the message reconstruction over time

        setMessages(prev => toUIMessage({ chunk, conversation: prev, metadata: { mode: 'stream' } }));

        void (onChunk ?? _onChunk.current)?.(chunk);
      },
    });
    setIsRunning(false);
  };

  const declineToolCall = async (toolCallId: string) => {
    const onChunk = _onChunk.current;
    const currentRunId = _currentRunId.current;

    if (!currentRunId)
      return console.info('[declineToolCall] declineToolCall can only be called after a stream has started');

    setIsRunning(true);
    setToolCallApprovals(prev => ({ ...prev, [toolCallId]: { status: 'declined' } }));
    const agent = baseClient.getAgent(agentId);
    const response = await agent.declineToolCall({
      runId: currentRunId,
      toolCallId,
      requestContext: _requestContext.current,
    });

    if (_threadSubscriptionKeyRef.current) {
      return;
    }

    await response.processDataStream({
      onChunk: async (chunk: ChunkType) => {
        // Without this, React might batch intermediate chunks which would break the message reconstruction over time

        setMessages(prev => toUIMessage({ chunk, conversation: prev, metadata: { mode: 'stream' } }));

        void (onChunk ?? _onChunk.current)?.(chunk);
      },
    });
    setIsRunning(false);
  };

  const approveToolCallGenerate = async (toolCallId: string) => {
    const currentRunId = _currentRunId.current;

    if (!currentRunId)
      return console.info(
        '[approveToolCallGenerate] approveToolCallGenerate can only be called after a generate has started',
      );

    setIsRunning(true);
    setToolCallApprovals(prev => ({ ...prev, [toolCallId]: { status: 'approved' } }));

    const agent = baseClient.getAgent(agentId);
    const response = await agent.approveToolCallGenerate({
      runId: currentRunId,
      toolCallId,
      requestContext: _requestContext.current,
    });

    if (response && 'uiMessages' in response.response && response.response.uiMessages) {
      const mastraUIMessages: MastraUIMessage[] = (response.response.uiMessages || []).map((message: any) => ({
        ...message,
        metadata: {
          mode: 'generate',
        },
      }));

      setMessages(prev => [...prev, ...mastraUIMessages]);
    }

    setIsRunning(false);
  };

  const declineToolCallGenerate = async (toolCallId: string) => {
    const currentRunId = _currentRunId.current;

    if (!currentRunId)
      return console.info(
        '[declineToolCallGenerate] declineToolCallGenerate can only be called after a generate has started',
      );

    setIsRunning(true);
    setToolCallApprovals(prev => ({ ...prev, [toolCallId]: { status: 'declined' } }));

    const agent = baseClient.getAgent(agentId);
    const response = await agent.declineToolCallGenerate({
      runId: currentRunId,
      toolCallId,
      requestContext: _requestContext.current,
    });

    if (response && 'uiMessages' in response.response && response.response.uiMessages) {
      const mastraUIMessages: MastraUIMessage[] = (response.response.uiMessages || []).map((message: any) => ({
        ...message,
        metadata: {
          mode: 'generate',
        },
      }));

      setMessages(prev => [...prev, ...mastraUIMessages]);
    }

    setIsRunning(false);
  };

  const approveNetworkToolCall = async (toolName: string, runId?: string) => {
    const onNetworkChunk = _onNetworkChunk.current;
    const networkRunId = runId || _networkRunId.current;

    if (!networkRunId)
      return console.info(
        '[approveNetworkToolCall] approveNetworkToolCall can only be called after a network stream has started',
      );

    setIsRunning(true);
    setNetworkToolCallApprovals(prev => ({
      ...prev,
      [runId ? `${runId}-${toolName}` : toolName]: { status: 'approved' },
    }));

    const agent = baseClient.getAgent(agentId);
    const response = await agent.approveNetworkToolCall({
      runId: networkRunId,
      requestContext: _requestContext.current,
    });

    const transformer = new AISdkNetworkTransformer();

    await response.processDataStream({
      onChunk: async (chunk: NetworkChunkType) => {
        setMessages(prev => transformer.transform({ chunk, conversation: prev, metadata: { mode: 'network' } }));
        void onNetworkChunk?.(chunk);
      },
    });

    setIsRunning(false);
  };

  const declineNetworkToolCall = async (toolName: string, runId?: string) => {
    const onNetworkChunk = _onNetworkChunk.current;
    const networkRunId = runId || _networkRunId.current;

    if (!networkRunId)
      return console.info(
        '[declineNetworkToolCall] declineNetworkToolCall can only be called after a network stream has started',
      );

    setIsRunning(true);
    setNetworkToolCallApprovals(prev => ({
      ...prev,
      [runId ? `${runId}-${toolName}` : toolName]: { status: 'declined' },
    }));

    const agent = baseClient.getAgent(agentId);
    const response = await agent.declineNetworkToolCall({
      runId: networkRunId,
      requestContext: _requestContext.current,
    });

    const transformer = new AISdkNetworkTransformer();

    await response.processDataStream({
      onChunk: async (chunk: NetworkChunkType) => {
        setMessages(prev => transformer.transform({ chunk, conversation: prev, metadata: { mode: 'network' } }));
        void onNetworkChunk?.(chunk);
      },
    });

    setIsRunning(false);
  };

  const sendMessage = async ({ mode = 'stream', ...args }: SendMessageArgs) => {
    const nextMessage: Omit<CoreUserMessage, 'id'> = { role: 'user', content: [{ type: 'text', text: args.message }] };
    const coreUserMessages = [nextMessage];

    if (args.coreUserMessages) {
      coreUserMessages.push(...args.coreUserMessages);
    }

    const uiMessages = coreUserMessages.map(fromCoreUserMessageToUIMessage);
    setMessages(s => [...s, ...uiMessages] as MastraUIMessage[]);

    if (mode === 'generate') {
      await generate({ ...args, coreUserMessages });
    } else if (mode === 'stream') {
      await stream({ ...args, coreUserMessages, signalId: uiMessages[0]?.id });
    } else if (mode === 'network') {
      await network({ ...args, coreUserMessages });
    }
  };

  return {
    setMessages,
    sendMessage,
    isRunning,
    messages,
    approveToolCall,
    declineToolCall,
    approveToolCallGenerate,
    declineToolCallGenerate,
    cancelRun: handleCancelRun,
    toolCallApprovals,
    approveNetworkToolCall,
    declineNetworkToolCall,
    networkToolCallApprovals,
  };
};
