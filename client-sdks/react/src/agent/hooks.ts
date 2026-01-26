import { type ModelSettings } from './types';
import { useMastraClient } from '@/mastra-client-context';
import { type UIMessage } from '@ai-sdk/react';
import { type ExtendedMastraUIMessage, type MastraUIMessage } from '../lib/ai-sdk';
import { MastraClient } from '@mastra/client-js';
import { type CoreUserMessage } from '@mastra/core/llm';
import { type RequestContext } from '@mastra/core/request-context';
import { type ChunkType, type NetworkChunkType } from '@mastra/core/stream';
import { useRef, useState } from 'react';
import { toUIMessage } from '@/lib/ai-sdk';
import { AISdkNetworkTransformer } from '@/lib/ai-sdk/transformers/AISdkNetworkTransformer';
import { resolveInitialMessages } from '@/lib/ai-sdk/memory/resolveInitialMessages';
import { fromCoreUserMessageToUIMessage } from '@/lib/ai-sdk/utils/fromCoreUserMessageToUIMessage';
import { v4 as uuid } from '@lukeed/uuid';
import { type TracingOptions } from '@mastra/core/observability';

export interface MastraChatProps {
  agentId: string;
  resourceId?: string;
  initializeMessages?: () => MastraUIMessage[];
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
};

export type NetworkArgs = SharedArgs & {
  onNetworkChunk?: (chunk: NetworkChunkType) => Promise<void>;
};

export const useChat = ({ agentId, resourceId, initializeMessages }: MastraChatProps) => {
  // Extract runId from any pending suspensions in initial messages
  const extractRunIdFromMessages = (messages: ExtendedMastraUIMessage[]): string | undefined => {
    for (const message of messages) {
      const pendingToolApprovals = message.metadata?.pendingToolApprovals as Record<string, any> | undefined;
      if (pendingToolApprovals && typeof pendingToolApprovals === 'object') {
        const suspensionData = Object.values(pendingToolApprovals)[0];
        if (suspensionData?.runId) {
          return suspensionData.runId;
        }
      }
    }
    return undefined;
  };

  const initialMessages = initializeMessages?.() || [];
  const initialRunId = extractRunIdFromMessages(initialMessages);

  const _currentRunId = useRef<string | undefined>(initialRunId);
  const _onChunk = useRef<((chunk: ChunkType) => Promise<void>) | undefined>(undefined);
  const _networkRunId = useRef<string | undefined>(undefined);
  const _onNetworkChunk = useRef<((chunk: NetworkChunkType) => Promise<void>) | undefined>(undefined);
  const [messages, setMessages] = useState<MastraUIMessage[]>(() => resolveInitialMessages(initialMessages));
  const [toolCallApprovals, setToolCallApprovals] = useState<{
    [toolCallId: string]: { status: 'approved' | 'declined' };
  }>({});
  const [networkToolCallApprovals, setNetworkToolCallApprovals] = useState<{
    [toolName: string]: { status: 'approved' | 'declined' };
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
      requestContext,
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

  const stream = async ({
    coreUserMessages,
    requestContext,
    threadId,
    onChunk,
    modelSettings,
    signal,
    tracingOptions,
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

    setIsRunning(true);

    // Create a new client instance with the abort signal
    // We can't use useMastraClient hook here, so we'll create the client directly
    const clientWithAbort = new MastraClient({
      ...baseClient!.options,
      abortSignal: signal,
    });

    const agent = clientWithAbort.getAgent(agentId);

    const runId = uuid();

    const response = await agent.stream(coreUserMessages, {
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
      ...(threadId ? { memory: { thread: threadId, resource: resourceId || agentId } } : {}),
      providerOptions: providerOptions as any,
      requireToolApproval,
      tracingOptions,
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
    tracingOptions,
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
      requestContext,
      ...(threadId ? { memory: { thread: threadId, resource: resourceId || agentId } } : {}),
      tracingOptions,
    });

    _onNetworkChunk.current = onNetworkChunk;
    _networkRunId.current = runId;

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
    _networkRunId.current = undefined;
    _onNetworkChunk.current = undefined;
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

  const approveToolCallGenerate = async (toolCallId: string) => {
    const currentRunId = _currentRunId.current;

    if (!currentRunId)
      return console.info(
        '[approveToolCallGenerate] approveToolCallGenerate can only be called after a generate has started',
      );

    setIsRunning(true);
    setToolCallApprovals(prev => ({ ...prev, [toolCallId]: { status: 'approved' } }));

    const agent = baseClient.getAgent(agentId);
    const response = await agent.approveToolCallGenerate({ runId: currentRunId, toolCallId });

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
    const response = await agent.declineToolCallGenerate({ runId: currentRunId, toolCallId });

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
    const response = await agent.approveNetworkToolCall({ runId: networkRunId });

    const transformer = new AISdkNetworkTransformer();

    await response.processDataStream({
      onChunk: async (chunk: NetworkChunkType) => {
        setMessages(prev => transformer.transform({ chunk, conversation: prev, metadata: { mode: 'network' } }));
        onNetworkChunk?.(chunk);
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
    const response = await agent.declineNetworkToolCall({ runId: networkRunId });

    const transformer = new AISdkNetworkTransformer();

    await response.processDataStream({
      onChunk: async (chunk: NetworkChunkType) => {
        setMessages(prev => transformer.transform({ chunk, conversation: prev, metadata: { mode: 'network' } }));
        onNetworkChunk?.(chunk);
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
    approveToolCallGenerate,
    declineToolCallGenerate,
    cancelRun: handleCancelRun,
    toolCallApprovals,
    approveNetworkToolCall,
    declineNetworkToolCall,
    networkToolCallApprovals,
  };
};
