import { ModelSettings } from './types';
import { useMastraClient } from '@/mastra-client-context';
import { UIMessage } from '@ai-sdk/react';
import { MastraUIMessage } from '../lib/ai-sdk';
import { MastraClient } from '@mastra/client-js';
import { CoreUserMessage } from '@mastra/core/llm';
import { RequestContext } from '@mastra/core/request-context';
import { ChunkType, NetworkChunkType } from '@mastra/core/stream';
import { useRef, useState } from 'react';
import { toUIMessage } from '@/lib/ai-sdk';
import { AISdkNetworkTransformer } from '@/lib/ai-sdk/transformers/AISdkNetworkTransformer';
import { resolveInitialMessages } from '@/lib/ai-sdk/memory/resolveInitialMessages';
import { fromCoreUserMessageToUIMessage } from '@/lib/ai-sdk/utils/fromCoreUserMessageToUIMessage';

export interface MastraChatProps {
  agentId: string;
  initializeMessages?: () => MastraUIMessage[];
}

interface SharedArgs {
  coreUserMessages: CoreUserMessage[];
  requestContext?: RequestContext;
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
  const _currentRunId = useRef<string | undefined>(undefined);
  const _onChunk = useRef<((chunk: ChunkType) => Promise<void>) | undefined>(undefined);
  const [messages, setMessages] = useState<MastraUIMessage[]>(() =>
    resolveInitialMessages(initializeMessages?.() || []),
  );
  const [toolCallApprovals, setToolCallApprovals] = useState<{
    [toolCallId: string]: { status: 'approved' | 'declined' };
  }>({});

  const baseClient = useMastraClient();
  const [isRunning, setIsRunning] = useState(false);

  const generate = async ({
    coreUserMessages,
    requestContext,
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
      requestContext,
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

  const stream = async ({ coreUserMessages, requestContext, threadId, onChunk, modelSettings, signal }: StreamArgs) => {
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

    setIsRunning(true);

    // Create a new client instance with the abort signal
    // We can't use useMastraClient hook here, so we'll create the client directly
    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

    const runId = agentId;

    const response = await agent.stream({
      messages: coreUserMessages,
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
      requestContext,
      ...(threadId ? { threadId, resourceId: agentId } : {}),
      providerOptions: providerOptions as any,
      requireToolApproval,
    });

    _onChunk.current = onChunk;
    _currentRunId.current = runId;

    await response.processDataStream({
      onChunk: async (chunk: ChunkType) => {
        // Without this, React might batch intermediate chunks which would break the message reconstruction over time

        setMessages(prev => toUIMessage({ chunk, conversation: prev, metadata: { mode: 'stream' } }));

        onChunk?.(chunk);
      },
    });

    setIsRunning(false);
  };

  const network = async ({
    coreUserMessages,
    requestContext,
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
      requestContext,
      ...(threadId ? { thread: threadId, resourceId: agentId } : {}),
    });

    const transformer = new AISdkNetworkTransformer();

    await response.processDataStream({
      onChunk: async (chunk: NetworkChunkType) => {
        setMessages(prev => transformer.transform({ chunk, conversation: prev, metadata: { mode: 'network' } }));
        onNetworkChunk?.(chunk);
      },
    });

    setIsRunning(false);
  };

  const handleCancelRun = () => {
    setIsRunning(false);
    _currentRunId.current = undefined;
    _onChunk.current = undefined;
  };

  const approveToolCall = async (toolCallId: string) => {
    const onChunk = _onChunk.current;
    const currentRunId = _currentRunId.current;

    if (!currentRunId)
      return console.info('[approveToolCall] approveToolCall can only be called after a stream has started');

    setIsRunning(true);
    setToolCallApprovals(prev => ({ ...prev, [toolCallId]: { status: 'approved' } }));

    const agent = baseClient.getAgent(agentId);
    const response = await agent.approveToolCall({ runId: currentRunId, toolCallId });

    await response.processDataStream({
      onChunk: async (chunk: ChunkType) => {
        // Without this, React might batch intermediate chunks which would break the message reconstruction over time

        setMessages(prev => toUIMessage({ chunk, conversation: prev, metadata: { mode: 'stream' } }));

        onChunk?.(chunk);
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
    const response = await agent.declineToolCall({ runId: currentRunId, toolCallId });

    await response.processDataStream({
      onChunk: async (chunk: ChunkType) => {
        // Without this, React might batch intermediate chunks which would break the message reconstruction over time

        setMessages(prev => toUIMessage({ chunk, conversation: prev, metadata: { mode: 'stream' } }));

        onChunk?.(chunk);
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
      await stream({ ...args, coreUserMessages });
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
    cancelRun: handleCancelRun,
    toolCallApprovals,
  };
};
