import type {
  ExecuteProcessorParams as ClientExecuteProcessorParams,
  ExecuteProcessorResponse,
  GetProcessorDetailResponse,
  GetProcessorResponse,
  ProcessorConfiguration,
  ProcessorPhase,
} from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

export type {
  GetProcessorDetailResponse as ProcessorDetail,
  GetProcessorResponse as ProcessorInfo,
  MastraDBMessage,
  ProcessorConfiguration,
  ProcessorPhase,
};

export interface ExecuteProcessorParams {
  processorId: string;
  phase: ClientExecuteProcessorParams['phase'];
  messages: MastraDBMessage[];
  agentId?: string;
}

export type { ExecuteProcessorResponse };

export const useProcessors = <TData = Record<string, GetProcessorResponse>>({
  requestContext,
  queryOptions,
}: {
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<Record<string, GetProcessorResponse>, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['processors'],
    queryFn: () => client.listProcessors(requestContext),
    ...queryOptions,
  });
};

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useProcessor = <TData = GetProcessorDetailResponse>({
  processorId,
  requestContext,
  queryOptions,
}: {
  processorId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<GetProcessorDetailResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['processor', processorId],
    queryFn: () => client.getProcessor(processorId).details(requestContext),
    ...queryOptions,
  });
};

export const useExecuteProcessor = ({
  requestContext,
  queryOptions,
}: {
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<ExecuteProcessorResponse, ExecuteProcessorParams>;
} = {}) => {
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
        requestContext,
      });
    },
    ...queryOptions,
  });
};
