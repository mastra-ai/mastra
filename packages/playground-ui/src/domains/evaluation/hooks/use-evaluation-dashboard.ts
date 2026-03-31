import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMergedRequestContext } from '@/domains/request-context';

export function useEvaluationScorers() {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
    queryKey: ['evaluation-scorers', requestContext],
    queryFn: () => client.listScorers(requestContext),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useEvaluationDatasets() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['evaluation-datasets'],
    queryFn: () => client.listDatasets(),
  });
}

export function useEvaluationExperiments() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['evaluation-experiments'],
    queryFn: () => client.listExperiments(),
  });
}
