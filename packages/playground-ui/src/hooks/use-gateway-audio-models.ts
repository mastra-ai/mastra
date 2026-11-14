import { useQuery } from '@tanstack/react-query';

import { listGatewayAudioModels } from '../utils/gateway-audio';

/** Fails closed: a missing key, disabled flag, or unavailable server yields no audio controls. */
export function useGatewayAudioModels(baseUrl: string, enabled: boolean) {
  const query = useQuery({
    queryKey: ['gateway-audio-models', baseUrl],
    queryFn: () => listGatewayAudioModels(baseUrl),
    enabled,
    retry: false,
    staleTime: 60_000,
    gcTime: 0,
    refetchOnWindowFocus: 'always',
  });
  return { ...query, data: query.isError ? undefined : query.data };
}
