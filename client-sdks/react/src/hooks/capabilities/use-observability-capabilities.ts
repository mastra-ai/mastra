import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

const OBSERVABILITY_CAPABILITIES_STALE_TIME = 24 * 60 * 60 * 1000;

export const useObservabilityCapabilities = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observability-capabilities'],
    queryFn: () => client.getObservabilityCapabilities(),
    retry: false,
    staleTime: OBSERVABILITY_CAPABILITIES_STALE_TIME,
  });
};
