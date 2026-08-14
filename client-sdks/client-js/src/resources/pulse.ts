import type { FlowDetail, FlowStatus, FlowSummary, FlowTimelineEntry } from '@mastra/core/storage';
import type { ClientOptions } from '../types';
import { BaseResource } from './base';

// ============================================================================
// Pulse Resource (experimental)
// ============================================================================

export interface ListPulseFlowsParams {
  status?: FlowStatus;
  threadId?: string;
  entityName?: string;
  page?: number;
  perPage?: number;
}

export interface ListPulseFlowsResponse {
  flows: FlowSummary[];
  total: number;
}

export interface GetPulseFlowResponse {
  flow: FlowDetail | null;
}

export interface GetPulseFlowTimelineResponse {
  timeline: FlowTimelineEntry[];
}

/**
 * Client resource for the experimental Pulse (event-first observability) API.
 * Flows, trees, durations and status are DERIVED server-side from append-only
 * pulse rows — endpoints return 501 unless the server has a pulse store
 * configured and a core with `pulse:v0` support.
 */
export class Pulse extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  /** Lists derived flows, most recent first. */
  listFlows(params: ListPulseFlowsParams = {}): Promise<ListPulseFlowsResponse> {
    const search = new URLSearchParams();
    if (params.status) search.set('status', params.status);
    if (params.threadId) search.set('threadId', params.threadId);
    if (params.entityName) search.set('entityName', params.entityName);
    if (params.page !== undefined) search.set('page', String(params.page));
    if (params.perPage !== undefined) search.set('perPage', String(params.perPage));
    const qs = search.toString();
    return this.request(`/pulse/flows${qs ? `?${qs}` : ''}`);
  }

  /** Retrieves one derived flow with its span tree and referenced definitions. */
  getFlow(flowId: string): Promise<GetPulseFlowResponse> {
    return this.request(`/pulse/flows/${flowId}`);
  }

  /** Retrieves the ordered pulse timeline of a flow (all capture lanes). */
  getFlowTimeline(flowId: string): Promise<GetPulseFlowTimelineResponse> {
    return this.request(`/pulse/flows/${flowId}/timeline`);
  }
}
