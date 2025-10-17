import { ModelSettings } from './types';
import { useMastraClient } from '@/mastra-client-context';
import { UIMessage } from '@ai-sdk/react';
import { MastraUIMessage } from '../lib/ai-sdk';
import { MastraClient } from '@mastra/client-js';
import { CoreUserMessage } from '@mastra/core/llm';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { ChunkType, NetworkChunkType } from '@mastra/core/stream';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { toUIMessage } from '@/lib/ai-sdk';
import { AISdkNetworkTransformer } from '@/lib/ai-sdk/transformers/AISdkNetworkTransformer';
import { resolveInitialMessages } from '@/lib/ai-sdk/memory/resolveInitialMessages';

export interface MastraChatProps {
  agentId: string;
  initializeMessages?: () => MastraUIMessage[];
}

interface SharedArgs {
  coreUserMessages: CoreUserMessage[];
  runtimeContext?: RuntimeContext;
  threadId?: string;
  modelSettings?: ModelSettings;
  signal?: AbortSignal;
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
};

export type NetworkArgs = SharedArgs & {
  onNetworkChunk?: (chunk: NetworkChunkType) => Promise<void>;
};

export const useChat = ({ agentId, initializeMessages }: MastraChatProps) => {
  const [messages, setMessages] = useState<MastraUIMessage[]>(() =>
    resolveInitialMessages(initializeMessages?.() || []),
  );

  const baseClient = useMastraClient();
  const [isRunning, setIsRunning] = useState(false);

  const generate = async ({
    coreUserMessages,
    runtimeContext,
    threadId,
    modelSettings,
    signal,
    onFinish,
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
      runtimeContext,
      ...(threadId ? { threadId, resourceId: agentId } : {}),
      providerOptions: providerOptions as any,
    });

    setIsRunning(false);

    if (response && 'uiMessages' in response.response && response.response.uiMessages) {
      onFinish?.(response.response.uiMessages);
      const mastraUIMessages: MastraUIMessage[] = (response.response.uiMessages || []).map(message => ({
        ...message,
        metadata: {
          mode: 'generate',
        },
      }));

      setMessages(prev => [...prev, ...mastraUIMessages]);
    }
  };

  const stream = async ({ coreUserMessages, runtimeContext, threadId, onChunk, modelSettings, signal }: StreamArgs) => {
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
      runtimeContext,
      ...(threadId ? { threadId, resourceId: agentId } : {}),
      providerOptions: providerOptions as any,
    });

    if (!response.body) {
      setIsRunning(false);
      throw new Error('[Stream] No response body');
    }

    await response.processDataStream({
      onChunk: async (chunk: ChunkType) => {
        // Without this, React might batch intermediate chunks which would break the message reconstruction over time
        flushSync(() => {
          setMessages(prev => toUIMessage({ chunk, conversation: prev, metadata: { mode: 'stream' } }));
        });

        onChunk?.(chunk);
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
  }: NetworkArgs) => {
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

    const transformer = new AISdkNetworkTransformer();

    await response.processDataStream({
      onChunk: async (chunk: NetworkChunkType) => {
        flushSync(() => {
          setMessages(prev => transformer.transform({ chunk, conversation: prev, metadata: { mode: 'network' } }));
        });

        onNetworkChunk?.(chunk);
      },
    });

    setIsRunning(false);
  };

  const sendMessage = async ({ mode = 'stream', ...args }: SendMessageArgs) => {
    const nextMessage: Omit<CoreUserMessage, 'id'> = { role: 'user', content: [{ type: 'text', text: args.message }] };
    const messages = args.coreUserMessages ? [nextMessage, ...args.coreUserMessages] : [nextMessage];

    setMessages(s => [...s, { role: 'user', parts: [{ type: 'text', text: args.message }] }] as MastraUIMessage[]);

    if (mode === 'generate') {
      await generate({ ...args, coreUserMessages: messages });
    } else if (mode === 'stream') {
      await stream({ ...args, coreUserMessages: messages });
    } else if (mode === 'network') {
      await network({ ...args, coreUserMessages: messages });
    }
  };

  return {
    setMessages,
    sendMessage,
    isRunning,
    messages,
    cancelRun: () => setIsRunning(false),
  };
};
