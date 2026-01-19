import { usePlaygroundStore } from '@/store/playground-store';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';

export type ProcessorPhase = 'input' | 'inputStep' | 'outputStream' | 'outputResult' | 'outputStep';

export interface ProcessorInfo {
  id: string;
  name?: string;
  description?: string;
  phases: ProcessorPhase[];
  agentIds: string[];
  isWorkflow: boolean;
}

export interface ProcessorConfiguration {
  agentId: string;
  agentName: string;
  type: 'input' | 'output';
}

export interface ProcessorDetail {
  id: string;
  name?: string;
  description?: string;
  phases: ProcessorPhase[];
  configurations: ProcessorConfiguration[];
  isWorkflow: boolean;
}

export type { MastraDBMessage };

export interface ExecuteProcessorParams {
  processorId: string;
  phase: ProcessorPhase;
  messages: MastraDBMessage[];
  agentId?: string;
}

export interface ProcessorTripwireResult {
  triggered: boolean;
  reason?: string;
  metadata?: unknown;
}

export interface ExecuteProcessorResponse {
  success: boolean;
  phase: string;
  messages?: MastraDBMessage[];
  messageList?: {
    messages: MastraDBMessage[];
  };
  tripwire?: ProcessorTripwireResult;
  error?: string;
}

export const useProcessors = () => {
  const { requestContext } = usePlaygroundStore();
  const client = useMastraClient();

  return useQuery({
    queryKey: ['processors'],
    queryFn: () => client.listProcessors(requestContext),
  });
};

export const useProcessor = (processorId: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['processor', processorId],
    queryFn: () => client.getProcessor(processorId).details(requestContext),
    enabled: options?.enabled !== false && !!processorId,
  });
};

export const useExecuteProcessor = () => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: async ({
      processorId,
      phase,
      messages,
      agentId,
    }: ExecuteProcessorParams): Promise<ExecuteProcessorResponse> => {
      return client.getProcessor(processorId).execute({
        phase,
        messages,
        agentId,
        requestContext,
      });
    },
  });
};
