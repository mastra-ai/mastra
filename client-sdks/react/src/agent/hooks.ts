import { useMutation, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type {
  GenerateParams,
  StreamParams,
  UpdateModelParams,
  StreamVNextParams,
  NetworkStreamParams,
} from '@mastra/client-js';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { OutputSchema } from '@mastra/core/stream';
import type { JSONSchema7 } from 'json-schema';
import type { ZodType } from 'zod';
import { useMastraClient } from '../mastra-client-context';

// Agent Voice Hooks

/**
 * Hook to convert text to speech using the agent's voice provider
 */
export const useAgentSpeak = (agentId: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: ({ text, options }: { text: string; options?: { speaker?: string; [key: string]: any } }) =>
      client.getAgent(agentId).voice.speak(text, options),
  });
};

/**
 * Hook to convert speech to text using the agent's voice provider
 */
export const useAgentListen = (agentId: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: ({ audio, options }: { audio: Blob; options?: Record<string, any> }) =>
      client.getAgent(agentId).voice.listen(audio, options),
  });
};

/**
 * Hook to get available speakers for the agent's voice provider
 */
export const useAgentSpeakers = (
  agentId: string,
  runtimeContext?: RuntimeContext | Record<string, any>,
  options?: Parameters<typeof useQuery>[0],
) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agent', agentId, 'voice', 'speakers', runtimeContext],
    queryFn: () => client.getAgent(agentId).voice.getSpeakers(runtimeContext),
    ...options,
  });
};

/**
 * Hook to get the listener configuration for the agent's voice provider
 */
export const useAgentListener = (
  agentId: string,
  runtimeContext?: RuntimeContext | Record<string, any>,
  options?: Parameters<typeof useQuery>[0],
) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['agent', agentId, 'voice', 'listener', runtimeContext],
    queryFn: () => client.getAgent(agentId).voice.getListener(runtimeContext),
    ...options,
  });
};

// Agent Hooks

/**
 * Hook to retrieve agent details
 */
export const useAgentDetails = (
  agentId: string,
  runtimeContext?: RuntimeContext | Record<string, any>,
  options?: Parameters<typeof useQuery>[0],
) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['agent', agentId, 'details', runtimeContext],
    queryFn: () => client.getAgent(agentId).details(runtimeContext),
    ...options,
  });
};

/**
 * Hook to generate a response from the agent
 */
export const useAgentGenerate = (agentId: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: <
      Output extends JSONSchema7 | ZodType | undefined = undefined,
      StructuredOutput extends JSONSchema7 | ZodType | undefined = undefined,
    >(
      params: GenerateParams<Output>,
    ) => client.getAgent(agentId).generate(params),
  });
};

/**
 * Hook to generate a response from the agent using legacy implementation
 */
export const useAgentGenerateLegacy = (agentId: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: <
      Output extends JSONSchema7 | ZodType | undefined = undefined,
      StructuredOutput extends JSONSchema7 | ZodType | undefined = undefined,
    >(
      params: GenerateParams<Output>,
    ) => client.getAgent(agentId).generateLegacy(params),
  });
};

/**
 * Hook to generate a response from the agent using vNext implementation
 */
export const useAgentGenerateVNext = (agentId: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: <OUTPUT extends OutputSchema = undefined>({
      messages,
      options,
    }: {
      messages: MessageListInput;
      options?: Omit<StreamVNextParams<OUTPUT>, 'messages'>;
    }) => client.getAgent(agentId).generateVNext(messages, options),
  });
};

/**
 * Hook to stream a response from the agent
 */
export const useAgentStream = (agentId: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: <T extends JSONSchema7 | ZodType | undefined = undefined>(params: StreamParams<T>) =>
      client.getAgent(agentId).stream(params),
  });
};

/**
 * Hook to stream a response from the agent using legacy implementation
 */
export const useAgentStreamLegacy = (agentId: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: <T extends JSONSchema7 | ZodType | undefined = undefined>(params: StreamParams<T>) =>
      client.getAgent(agentId).streamLegacy(params),
  });
};

/**
 * Hook to stream a response from the agent using vNext implementation
 */
export const useAgentStreamVNext = (agentId: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: <OUTPUT extends OutputSchema = undefined>({
      messages,
      options,
    }: {
      messages: MessageListInput;
      options?: Omit<StreamVNextParams<OUTPUT>, 'messages'>;
    }) => client.getAgent(agentId).streamVNext(messages, options),
  });
};

/**
 * Hook for agent network streaming
 */
export const useAgentNetwork = (agentId: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: (params: NetworkStreamParams) => client.getAgent(agentId).network(params),
  });
};

/**
 * Hook to get details about a specific tool available to the agent
 */
export const useAgentTool = (
  agentId: string,
  toolId: string,
  runtimeContext?: RuntimeContext | Record<string, any>,
  options?: Parameters<typeof useQuery>[0],
) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['agent', agentId, 'tool', toolId, runtimeContext],
    queryFn: () => client.getAgent(agentId).getTool(toolId, runtimeContext),
    ...options,
  });
};

/**
 * Hook to execute a tool for the agent
 */
export const useAgentExecuteTool = (agentId: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: ({
      toolId,
      params,
    }: {
      toolId: string;
      params: { data: any; runtimeContext?: RuntimeContext | Record<string, any> };
    }) => client.getAgent(agentId).executeTool(toolId, params),
  });
};

/**
 * Hook to retrieve evaluation results for the agent
 */
export const useAgentEvals = (
  agentId: string,
  runtimeContext?: RuntimeContext | Record<string, any>,
  options?: Parameters<typeof useQuery>[0],
) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['agent', agentId, 'evals', runtimeContext],
    queryFn: () => client.getAgent(agentId).evals(runtimeContext),
    ...options,
  });
};

/**
 * Hook to retrieve live evaluation results for the agent
 */
export const useAgentLiveEvals = (
  agentId: string,
  runtimeContext?: RuntimeContext | Record<string, any>,
  options?: Parameters<typeof useQuery>[0],
) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['agent', agentId, 'liveEvals', runtimeContext],
    queryFn: () => client.getAgent(agentId).liveEvals(runtimeContext),
    ...options,
  });
};

/**
 * Hook to update the model for the agent
 */
export const useAgentUpdateModel = (agentId: string) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: (params: UpdateModelParams) => client.getAgent(agentId).updateModel(params),
  });
};
