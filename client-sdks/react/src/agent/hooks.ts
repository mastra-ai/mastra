import { ModelSettings } from './types';
import { useMastraClient } from '@/mastra-client-context';
import { UIMessage } from '@ai-sdk/react';
import { MastraClient } from '@mastra/client-js';
import { CoreUserMessage } from '@mastra/core/llm';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { ChunkType, NetworkChunkType } from '@mastra/core/stream';
import { useState } from 'react';
import { flushSync } from 'react-dom';

export interface MastraChatProps<TMessage> {
  agentId: string;
  initializeMessages?: () => TMessage[];
}

interface SharedArgs {
  coreUserMessages: CoreUserMessage[];
  runtimeContext?: RuntimeContext;
  threadId?: string;
  modelSettings?: ModelSettings;
  signal?: AbortSignal;
}

export type GenerateArgs<TMessage> = SharedArgs & { onFinish: (messages: UIMessage[]) => TMessage[] };

export type StreamArgs<TMessage> = SharedArgs & {
  onChunk: (chunk: ChunkType, conversation: TMessage[]) => TMessage[];
};

export type NetworkArgs<TMessage> = SharedArgs & {
  onNetworkChunk: (chunk: NetworkChunkType, conversation: TMessage[]) => TMessage[];
};

export const useChat = <TMessage>({ agentId, initializeMessages }: MastraChatProps<TMessage>) => {
  const [messages, setMessages] = useState<TMessage[]>(initializeMessages || []);
  const baseClient = useMastraClient();
  const [isRunning, setIsRunning] = useState(false);

  const generate = async ({
    coreUserMessages,
    runtimeContext,
    threadId,
    modelSettings,
    signal,
    onFinish,
  }: GenerateArgs<TMessage>) => {
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

    const response = await agent.generate({
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

    setIsRunning(false);

    if (response && 'uiMessages' in response.response && response.response.uiMessages) {
      const formatted = onFinish(response.response.uiMessages);
      setMessages(prev => [...prev, ...formatted]);
    }
  };

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
        // Without this, React might batch intermediate chunks which would break the message reconstruction over time
        flushSync(() => {
          setMessages(prev => onChunk(chunk, prev));
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
        flushSync(() => {
          setMessages(prev => onNetworkChunk(chunk, prev));
        });

        return Promise.resolve();
      },
    });

    setIsRunning(false);
  };

  return {
    network,
    stream,
    generate,
    isRunning,
    messages,
    setMessages,
    cancelRun: () => setIsRunning(false),
  };
};
