import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { VoiceSettingsResponse } from '../api/types';

/** The caller's speech-to-text model for composer voice input, stored per user. */
export function useVoiceSettings() {
  const { client } = useApiConfig();
  return useQuery<VoiceSettingsResponse>({
    queryKey: queryKeys.voiceSettings(),
    queryFn: () => client.get<VoiceSettingsResponse>('/web/voice/settings'),
  });
}

/** `null` goes back to auto. The response is the refreshed settings, written straight into the cache. */
export function useUpdateVoiceSettings() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (choice: { provider: string; model: string } | null) =>
      client.put<VoiceSettingsResponse>('/web/voice/settings', choice ?? { provider: null }),
    onSuccess: res => queryClient.setQueryData(queryKeys.voiceSettings(), res),
  });
}
