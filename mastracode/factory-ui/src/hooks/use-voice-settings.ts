import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { VoiceChoice, VoiceSettingsResponse } from '../api/types';

export interface VoiceSettings {
  scope: VoiceSettingsResponse['scope'];
  /** Absent is auto. */
  selected?: VoiceChoice;
  canEdit: boolean;
  /** Absent when no usable key exists. */
  effective?: VoiceChoice;
  models: VoiceSettingsResponse['models'];
  keys: VoiceSettingsResponse['keys'];
}

export type VoiceModel = VoiceSettings['models'][number];
export type VoiceKeyStatus = VoiceSettings['keys'][number];

function fromResponse(res: VoiceSettingsResponse): VoiceSettings {
  return {
    scope: res.scope,
    selected: res.selected ?? undefined,
    canEdit: res.canEdit,
    effective: res.effective ?? undefined,
    models: res.models,
    keys: res.keys,
  };
}

export function useVoiceSettings(factoryId: string) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.voiceSettings(factoryId),
    queryFn: () => client.get<VoiceSettingsResponse>(`/web/voice/settings?factoryId=${encodeURIComponent(factoryId)}`),
    select: fromResponse,
  });
}

/** Saves the model on the side voice input uses; no choice goes back to auto. The response refreshes the cache. */
export function useUpdateVoiceSettings(factoryId: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (choice: VoiceChoice | undefined) =>
      client.put<VoiceSettingsResponse>('/web/voice/settings', { factoryId, ...(choice ?? { provider: null }) }),
    onSuccess: res => queryClient.setQueryData(queryKeys.voiceSettings(factoryId), res),
  });
}
