import type { Body, PathParams, QueryParams, RouteKey, RouteResponse, Simplify } from '../route-types.generated.js';

type Serialized<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

type Response<Route extends RouteKey> = Serialized<RouteResponse<Route>>;
type Query<Route extends RouteKey> = QueryParams<Route>;

type ListArgs<T extends object> = Simplify<
  Pick<T, Extract<keyof T, 'mode' | 'after' | 'limit'>> & {
    filters?: Omit<T, 'page' | 'perPage' | 'field' | 'direction' | 'mode' | 'after' | 'limit'>;
    pagination?: Pick<T, Extract<keyof T, 'page' | 'perPage'>>;
    orderBy?: Pick<T, Extract<keyof T, 'field' | 'direction'>>;
  }
>;

export type TraceRecord = Response<'GET /observability/traces/:traceId'>;
export type GetTraceLightResponse = Response<'GET /observability/traces/:traceId/light'>;
export type GetSpanResponse = Response<'GET /observability/traces/:traceId/spans/:spanId'>;
export type ListTracesArgs = ListArgs<Query<'GET /observability/traces'>>;
export type ListTracesResponse = Response<'GET /observability/traces'>;
export type ListTracesLightResponse = Response<'GET /observability/traces/light'>;
export type TraceQueryRequest = Body<'POST /observability/traces/query'>;
export type TraceQueryResponse = Response<'POST /observability/traces/query'>;
export type ListBranchesArgs = ListArgs<Query<'GET /observability/branches'>>;
export type ListBranchesResponse = Response<'GET /observability/branches'>;
export type GetBranchArgs = PathParams<'GET /observability/traces/:traceId/branches/:spanId'> &
  Query<'GET /observability/traces/:traceId/branches/:spanId'>;
export type GetBranchResponse = Response<'GET /observability/traces/:traceId/branches/:spanId'>;
export type SpanIds = PathParams<'GET /observability/traces/:traceId/:spanId/scores'>;
export type PaginationArgs = Query<'GET /observability/traces/:traceId/:spanId/scores'>;
export type SpanRecord = ListTracesResponse['spans'][number];
export type PaginationInfo = NonNullable<ListTracesResponse['pagination']>;
export type ScoreTracesRequest = Body<'POST /observability/traces/score'>;
export type ScoreTracesResponse = Response<'POST /observability/traces/score'>;
export type ListScoresResponse = Response<'GET /observability/traces/:traceId/:spanId/scores'>;
export type Trajectory = Response<'GET /observability/traces/:traceId/trajectory'>;
export type ListLogsArgs = ListArgs<Query<'GET /observability/logs'>>;
export type ListLogsResponse = Response<'GET /observability/logs'>;
export type ListScoresArgs = ListArgs<Query<'GET /observability/scores'>>;
export type ListScoresResponseNew = Response<'GET /observability/scores'>;
export type CreateScoreBody = Body<'POST /observability/scores'>;
export type CreateScoreResponse = Response<'POST /observability/scores'>;
export type DeleteScoresArgs = Body<'DELETE /observability/scores'>;
export type DeleteScoresResponse = Response<'DELETE /observability/scores'>;
export type GetScoreAggregateArgs = Body<'POST /observability/scores/aggregate'>;
export type GetScoreAggregateResponse = Response<'POST /observability/scores/aggregate'>;
export type GetScoreBreakdownArgs = Body<'POST /observability/scores/breakdown'>;
export type GetScoreBreakdownResponse = Response<'POST /observability/scores/breakdown'>;
export type GetScoreTimeSeriesArgs = Body<'POST /observability/scores/timeseries'>;
export type GetScoreTimeSeriesResponse = Response<'POST /observability/scores/timeseries'>;
export type GetScorePercentilesArgs = Body<'POST /observability/scores/percentiles'>;
export type GetScorePercentilesResponse = Response<'POST /observability/scores/percentiles'>;
export type ListFeedbackArgs = ListArgs<Query<'GET /observability/feedback'>>;
export type CreateFeedbackBody = Body<'POST /observability/feedback'>;
export type CreateFeedbackResponse = Response<'POST /observability/feedback'>;
export type DeleteFeedbackArgs = Body<'DELETE /observability/feedback'>;
export type DeleteFeedbackResponse = Response<'DELETE /observability/feedback'>;
export type UpdateFeedbackReviewStatusArgs = PathParams<'PATCH /observability/feedback/:feedbackId/review-status'> &
  Body<'PATCH /observability/feedback/:feedbackId/review-status'>;
export type FeedbackRecord = Response<'PATCH /observability/feedback/:feedbackId/review-status'>;
export type GetFeedbackAggregateArgs = Body<'POST /observability/feedback/aggregate'>;
export type GetFeedbackAggregateResponse = Response<'POST /observability/feedback/aggregate'>;
export type GetFeedbackBreakdownArgs = Body<'POST /observability/feedback/breakdown'>;
export type GetFeedbackBreakdownResponse = Response<'POST /observability/feedback/breakdown'>;
export type GetFeedbackTimeSeriesArgs = Body<'POST /observability/feedback/timeseries'>;
export type GetFeedbackTimeSeriesResponse = Response<'POST /observability/feedback/timeseries'>;
export type GetFeedbackPercentilesArgs = Body<'POST /observability/feedback/percentiles'>;
export type GetFeedbackPercentilesResponse = Response<'POST /observability/feedback/percentiles'>;
export type GetMetricAggregateArgs = Body<'POST /observability/metrics/aggregate'>;
export type GetMetricAggregateResponse = Response<'POST /observability/metrics/aggregate'>;
export type GetMetricBreakdownArgs = Body<'POST /observability/metrics/breakdown'>;
export type GetMetricBreakdownResponse = Response<'POST /observability/metrics/breakdown'>;
export type GetMetricTimeSeriesArgs = Body<'POST /observability/metrics/timeseries'>;
export type GetMetricTimeSeriesResponse = Response<'POST /observability/metrics/timeseries'>;
export type GetMetricPercentilesArgs = Body<'POST /observability/metrics/percentiles'>;
export type GetMetricPercentilesResponse = Response<'POST /observability/metrics/percentiles'>;
export type GetMetricNamesArgs = Query<'GET /observability/discovery/metric-names'>;
export type GetMetricNamesResponse = Response<'GET /observability/discovery/metric-names'>;
export type GetMetricLabelKeysArgs = Query<'GET /observability/discovery/metric-label-keys'>;
export type GetMetricLabelKeysResponse = Response<'GET /observability/discovery/metric-label-keys'>;
export type GetMetricLabelValuesArgs = Query<'GET /observability/discovery/metric-label-values'>;
export type GetMetricLabelValuesResponse = Response<'GET /observability/discovery/metric-label-values'>;
export type GetEntityTypesResponse = Response<'GET /observability/discovery/entity-types'>;
export type GetEntityNamesArgs = Query<'GET /observability/discovery/entity-names'>;
export type GetEntityNamesResponse = Response<'GET /observability/discovery/entity-names'>;
export type GetServiceNamesResponse = Response<'GET /observability/discovery/service-names'>;
export type GetEnvironmentsResponse = Response<'GET /observability/discovery/environments'>;
export type GetTagsArgs = Query<'GET /observability/discovery/tags'>;
export type GetTagsResponse = Response<'GET /observability/discovery/tags'>;
