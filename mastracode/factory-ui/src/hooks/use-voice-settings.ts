import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { VoiceChoice, VoiceSettingsResponse } from '../api/types';

export type VoiceModel = VoiceSettingsResponse['models'][number];
export type VoiceKeyStatus = VoiceSettingsResponse['keys'][number];

export function useVoiceSettings(factoryId: string) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.voiceSettings(factoryId),
    queryFn: () => client.get<VoiceSettingsResponse>(`/web/voice/settings?factoryId=${encodeURIComponent(factoryId)}`),
  });
}

/**
 * Saves the model on the side voice input uses; `null` goes back to auto. The response refreshes this
 * Factory's cache; other Factories are refetched because a personal choice is shared across them.
 */
export function useUpdateVoiceSettings(factoryId: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (choice: VoiceChoice | null) =>
      client.put<VoiceSettingsResponse>('/web/voice/settings', { factoryId, ...(choice ?? { provider: null }) }),
    onSuccess: res => {
      queryClient.setQueryData(queryKeys.voiceSettings(factoryId), res);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.voiceSettingsAll(),
        predicate: query => query.queryKey[1] !== factoryId,
      });
    },
  });
}
