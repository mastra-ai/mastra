import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type {
  GetMetricAggregateArgs,
  GetMetricBreakdownArgs,
  GetMetricTimeSeriesArgs,
  GetMetricPercentilesArgs,
  ListLogsArgs,
  ListScoresArgs,
  ListFeedbackArgs,
  GetEntityNamesArgs,
} from '@mastra/core/storage';

/** Fetches distinct metric names from the observability store. */
export const useMetricNames = () => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['metric-names'],
    queryFn: () => client.getMetricNames(),
  });
};

/** Fetches distinct entity types from observability data. */
export const useEntityTypes = () => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['entity-types'],
    queryFn: () => client.getEntityTypes(),
  });
};

/** Fetches distinct entity names with optional type filtering. */
export const useEntityNames = (args: GetEntityNamesArgs = {}) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['entity-names', args],
    queryFn: () => client.getEntityNames(args),
  });
};

/** Fetches distinct environments from observability data. */
export const useEnvironments = () => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['environments'],
    queryFn: () => client.getEnvironments(),
  });
};

/** Fetches distinct service names from observability data. */
export const useServiceNames = () => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['service-names'],
    queryFn: () => client.getServiceNames(),
  });
};

/** Fetches an aggregated metric value with optional period-over-period comparison. */
export const useMetricAggregate = (args: GetMetricAggregateArgs) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['metric-aggregate', args],
    queryFn: () => client.getMetricAggregate(args),
  });
};

/** Fetches metric values grouped by specified dimensions. */
export const useMetricBreakdown = (args: GetMetricBreakdownArgs) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['metric-breakdown', args],
    queryFn: () => client.getMetricBreakdown(args),
  });
};

/** Fetches metric values bucketed by time interval with optional grouping. */
export const useMetricTimeSeries = (args: GetMetricTimeSeriesArgs) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['metric-timeseries', args],
    queryFn: () => client.getMetricTimeSeries(args),
  });
};

/** Fetches percentile values for a metric bucketed by time interval. */
export const useMetricPercentiles = (args: GetMetricPercentilesArgs) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['metric-percentiles', args],
    queryFn: () => client.getMetricPercentiles(args),
  });
};

/** Fetches a paginated list of observability logs. */
export const useObsLogs = (args: ListLogsArgs = {}) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['obs-logs', args],
    queryFn: () => client.listLogsVNext(args),
  });
};

/** Fetches a paginated list of observability scores. */
export const useObsScores = (args: ListScoresArgs = {}) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['obs-scores', args],
    queryFn: () => client.listScores(args),
  });
};

/** Fetches a paginated list of feedback records. */
export const useObsFeedback = (args: ListFeedbackArgs = {}) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['obs-feedback', args],
    queryFn: () => client.listFeedback(args),
  });
};
