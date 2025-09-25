import { ModelSettings } from './types';
import { useMastraClient } from '@/mastra-client-context';
import { MastraClient } from '@mastra/client-js';
import { CoreUserMessage } from '@mastra/core/llm';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { ChunkType, NetworkChunkType } from '@mastra/core/stream';
import { UIMessage } from 'ai';
import { useRef, useState } from 'react';
import { toUIMessage } from './lib/toUIMessage';

export interface MastraChatProps<TMessage> {
  agentId: string;
  initializeMessages?: () => TMessage[];
}

export interface StreamVNextArgs<TMessage> {
  coreUserMessages: CoreUserMessage[];
  runtimeContext?: RuntimeContext;
  threadId?: string;
  onChunk?: ({ chunk, conversation }: { chunk: ChunkType; conversation: TMessage[] }) => TMessage[];
  modelSettings?: ModelSettings;
}

export interface NetworkArgs<TMessage> {
  coreUserMessages: CoreUserMessage[];
  runtimeContext?: RuntimeContext;
  threadId?: string;
  onNetworkChunk: ({ chunk, conversation }: { chunk: NetworkChunkType; conversation: TMessage[] }) => TMessage[];
  modelSettings?: ModelSettings;
}

export const useMastraChat = <TMessage = UIMessage>({ agentId, initializeMessages }: MastraChatProps<TMessage>) => {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<TMessage[]>(initializeMessages || []);
  const baseClient = useMastraClient();
  const [isRunning, setIsRunning] = useState(false);

  const streamVNext = async ({
    coreUserMessages,
    runtimeContext,
    threadId,
    onChunk,
    modelSettings,
  }: StreamVNextArgs<TMessage>) => {
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
    } = modelSettings || {};

    abortControllerRef.current = new AbortController();
    setIsRunning(true);

    // Create a new client instance with the abort signal
    // We can't use useMastraClient hook here, so we'll create the client directly
    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: abortControllerRef.current.signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

    const response = await agent.streamVNext({
      messages: coreUserMessages,
      runId: agentId,
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
      runtimeContext,
      ...(threadId ? { threadId, resourceId: agentId } : {}),
      providerOptions: providerOptions as any,
    });

    if (!response.body) {
      setIsRunning(false);
      throw new Error('[StreamVNext] No response body');
    }

    await response.processDataStream({
      onChunk: (chunk: ChunkType) => {
        setMessages(prev => {
          const fn = onChunk || toUIMessage;
          return fn({ chunk, conversation: prev as any }) as TMessage[];
        });
        return Promise.resolve();
      },
    });

    setIsRunning(false);
  };

  const network = async ({
    coreUserMessages,
    runtimeContext,
    threadId,
    onNetworkChunk,
    modelSettings,
  }: NetworkArgs<TMessage>) => {
    const { frequencyPenalty, presencePenalty, maxRetries, maxTokens, temperature, topK, topP, maxSteps } =
      modelSettings || {};

    abortControllerRef.current = new AbortController();
    setIsRunning(true);

    // Create a new client instance with the abort signal
    // We can't use useMastraClient hook here, so we'll create the client directly
    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: abortControllerRef.current.signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

    const response = await agent.network({
      messages: coreUserMessages,
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
      runId: agentId,
      runtimeContext,
      ...(threadId ? { thread: threadId, resourceId: agentId } : {}),
    });

    await response.processDataStream({
      onChunk: (chunk: NetworkChunkType) => {
        setMessages(conversation => onNetworkChunk({ chunk, conversation }));
        return Promise.resolve();
      },
    });

    setIsRunning(false);
  };

  return {
    network,
    streamVNext,
    isRunning,
    messages,
    setMessages,
    cancelRun: async () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsRunning(false);
    },
  };
};
