import type {
  ExecuteProcessorResponse,
  GetProcessorDetailResponse,
  GetProcessorResponse,
  ProcessorConfiguration,
  ProcessorPhase,
} from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { useMastraClient } from '@mastra/react';
import { useQuery, useMutation } from '@tanstack/react-query';

export type {
  GetProcessorDetailResponse as ProcessorDetail,
  GetProcessorResponse as ProcessorInfo,
  MastraDBMessage,
  ProcessorConfiguration,
  ProcessorPhase,
};

export interface ExecuteProcessorParams {
  processorId: string;
  phase: ProcessorPhase;
  messages: MastraDBMessage[];
  agentId?: string;
}

export type { ExecuteProcessorResponse };

export const useProcessors = (options?: { enabled?: boolean }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['processors'],
    queryFn: () => client.listProcessors(),
    enabled: options?.enabled ?? true,
  });
};

export const useProcessor = (processorId: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['processor', processorId],
    queryFn: () => client.getProcessor(processorId).details(),
    enabled: options?.enabled !== false && !!processorId,
  });
};

export const useExecuteProcessor = () => {
  const client = useMastraClient();

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
      });
    },
  });
};
