import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/** Mounted only while the review dialog is open; signed links are never kept as durable trace data. */
export function useLiveKitRecording(traceId: string) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['livekit-recording', traceId],
    queryFn: () => client.getLiveKitRecording(traceId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
