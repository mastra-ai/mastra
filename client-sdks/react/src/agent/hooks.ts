import { ModelSettings } from './types';
import { useMastraClient } from '@/mastra-client-context';
import { MastraClient } from '@mastra/client-js';
import { CoreUserMessage } from '@mastra/core/llm';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { ChunkType, NetworkChunkType } from '@mastra/core/stream';
import { useState } from 'react';

export interface MastraChatProps<TMessage> {
  agentId: string;
  initializeMessages?: () => TMessage[];
}

export interface StreamArgs<TMessage> {
  coreUserMessages: CoreUserMessage[];
  runtimeContext?: RuntimeContext;
  threadId?: string;
  onChunk: (chunk: ChunkType, conversation: TMessage[]) => TMessage[];
  modelSettings?: ModelSettings;
  signal?: AbortSignal;
}

export interface NetworkArgs<TMessage> {
  coreUserMessages: CoreUserMessage[];
  runtimeContext?: RuntimeContext;
  threadId?: string;
  onNetworkChunk: (chunk: NetworkChunkType, conversation: TMessage[]) => TMessage[];
  modelSettings?: ModelSettings;
  signal?: AbortSignal;
}

export const useMastraChat = <TMessage>({ agentId, initializeMessages }: MastraChatProps<TMessage>) => {
  const [messages, setMessages] = useState<TMessage[]>(initializeMessages || []);
  const baseClient = useMastraClient();
  const [isRunning, setIsRunning] = useState(false);

const stream = async ({
    coreUserMessages,
    runtimeContext,
    threadId,
    onChunk,
    modelSettings,
    signal,
  }: StreamArgs<TMessage>) => {
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

    setIsRunning(true);

    // Create a new client instance with the abort signal
    // We can't use useMastraClient hook here, so we'll create the client directly
    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

const response = await agent.stream({
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
throw new Error('[Stream] No response body');
    }

    await response.processDataStream({
      onChunk: (chunk: ChunkType) => {
        setMessages(prev => onChunk(chunk, prev));
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
    signal,
  }: NetworkArgs<TMessage>) => {
    const { frequencyPenalty, presencePenalty, maxRetries, maxTokens, temperature, topK, topP, maxSteps } =
      modelSettings || {};

    setIsRunning(true);

    // Create a new client instance with the abort signal
    // We can't use useMastraClient hook here, so we'll create the client directly
    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: signal,
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
        setMessages(prev => onNetworkChunk(chunk, prev));
        return Promise.resolve();
      },
    });

    setIsRunning(false);
  };

return {
    network,
    stream,
    isRunning,
    messages,
    setMessages,
    cancelRun: () => setIsRunning(false),
  };
};
