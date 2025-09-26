import { ModelSettings } from './types';
import { useMastraClient } from '@/mastra-client-context';
import { MastraClient } from '@mastra/client-js';
import { CoreUserMessage } from '@mastra/core/llm';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { ChunkType, NetworkChunkType } from '@mastra/core/stream';

import { useRef, useState } from 'react';

export interface MastraChatProps {
  agentId: string;
}

export interface StreamVNextArgs {
  coreUserMessages: CoreUserMessage[];
  runtimeContext?: RuntimeContext;
  threadId?: string;
  onChunk?: ({ chunk }: { chunk: ChunkType }) => void;
  modelSettings?: ModelSettings;
}

export interface NetworkArgs {
  coreUserMessages: CoreUserMessage[];
  runtimeContext?: RuntimeContext;
  threadId?: string;
  onNetworkChunk?: ({ chunk }: { chunk: NetworkChunkType }) => void;
  modelSettings?: ModelSettings;
}

export const useAgent = ({ agentId }: MastraChatProps) => {
  const abortControllerRef = useRef<AbortController | null>(null);
  const baseClient = useMastraClient();
  const [isRunning, setIsRunning] = useState(false);

  const streamVNext = async ({
    coreUserMessages,
    runtimeContext,
    threadId,
    onChunk,
    modelSettings,
  }: StreamVNextArgs) => {
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
        onChunk?.({ chunk });
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
  }: NetworkArgs) => {
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
        onNetworkChunk?.({ chunk });
        return Promise.resolve();
      },
    });

    setIsRunning(false);
  };

  return {
    network,
    streamVNext,
    isRunning,
    cancelRun: async () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsRunning(false);
    },
  };
};
