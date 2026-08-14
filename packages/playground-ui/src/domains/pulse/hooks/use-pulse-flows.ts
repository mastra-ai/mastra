import type {
  GetPulseFlowResponse,
  GetPulseFlowTimelineResponse,
  ListPulseFlowsParams,
  ListPulseFlowsResponse,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

/** Live-tail interval for flows that are still running. Pulse rows are appended
 *  continuously while a flow runs, so 1s keeps the derived view fresh without
 *  hammering the store once every flow has settled (polling stops entirely then). */
export const PULSE_POLL_INTERVAL_MS = 1_000;

/** The pulse endpoints 501 when the server has no pulse store configured (or the
 *  core predates `pulse:v0`). Components use this to render an "unavailable"
 *  state instead of a generic error. */
export function isPulseUnavailableError(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 501;
}

/** Lists derived flows, most recent first. Polls every second while any returned
 *  flow is still `running`; stops polling as soon as every flow has settled. */
export function usePulseFlows(params: ListPulseFlowsParams = {}): UseQueryResult<ListPulseFlowsResponse> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['pulse-flows', params],
    queryFn: () => client.pulse.listFlows(params),
    retry: false,
    refetchInterval: query => {
      const flows = query.state.data?.flows;
      return flows?.some(flow => flow.status === 'running') ? PULSE_POLL_INTERVAL_MS : false;
    },
  });
}

/** Retrieves one derived flow (span tree + referenced definitions). Polls every
 *  second while the flow itself is `running`, otherwise fetches once. */
export function usePulseFlow(flowId: string | undefined): UseQueryResult<GetPulseFlowResponse> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['pulse-flow', flowId],
    queryFn: () => {
      if (!flowId) throw new Error('Flow ID is required');
      return client.pulse.getFlow(flowId);
    },
    enabled: !!flowId,
    retry: false,
    refetchInterval: query => (query.state.data?.flow?.status === 'running' ? PULSE_POLL_INTERVAL_MS : false),
  });
}

/** Retrieves the ordered pulse timeline of a flow. The timeline payload carries
 *  no status, so the caller passes `isFlowRunning` (from `usePulseFlow`) to keep
 *  polling only while the flow is live. */
export function usePulseFlowTimeline(
  flowId: string | undefined,
  isFlowRunning = false,
): UseQueryResult<GetPulseFlowTimelineResponse> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['pulse-flow-timeline', flowId],
    queryFn: () => {
      if (!flowId) throw new Error('Flow ID is required');
      return client.pulse.getFlowTimeline(flowId);
    },
    enabled: !!flowId,
    retry: false,
    refetchInterval: isFlowRunning ? PULSE_POLL_INTERVAL_MS : false,
  });
}
