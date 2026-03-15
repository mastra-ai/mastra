import { usePlaygroundStore } from '@/store/playground-store';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type {
  ProcessorPhase,
  ProcessorConfiguration,
  GetProcessorResponse as ProcessorInfo,
  GetProcessorDetailResponse as ProcessorDetail,
  ExecuteProcessorResponse,
  ProcessorTripwireResult,
} from '@mastra/client-js';

export type { ProcessorPhase, ProcessorInfo, ProcessorConfiguration, ProcessorDetail, MastraDBMessage, ExecuteProcessorResponse, ProcessorTripwireResult };

export interface ExecuteProcessorParams {
  processorId: string;
  phase: ProcessorPhase;
  messages: MastraDBMessage[];
  agentId?: string;
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
