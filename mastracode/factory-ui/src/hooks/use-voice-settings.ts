import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { VoiceChoice, VoiceSettingsResponse } from '../api/types';

/** Voice input settings as one Factory applies them, with the server's `null`s turned into absent fields. */
export interface VoiceSettings {
  modelScope: 'factory' | 'user' | 'hybrid';
  /** The caller's own choice; absent follows the Factory. */
  personal?: VoiceChoice;
  /** The Factory's choice; absent is auto. */
  factory?: VoiceChoice;
  canEditFactory: boolean;
  /** What voice input uses right now; absent when no usable key exists. */
  effective?: VoiceChoice;
  models: VoiceSettingsResponse['models'];
  keys: VoiceSettingsResponse['keys'];
}

export type VoiceModel = VoiceSettings['models'][number];
export type VoiceKeyStatus = VoiceSettings['keys'][number];

function fromResponse(res: VoiceSettingsResponse): VoiceSettings {
  return {
    modelScope: res.modelScope ?? 'hybrid',
    personal: res.personal ?? undefined,
    factory: res.factory ?? undefined,
    canEditFactory: res.canEditFactory,
    effective: res.effective ?? undefined,
    models: res.models,
    keys: res.keys,
  };
}

/** Both saved choices, the effective model, and key status for one Factory. */
export function useVoiceSettings(factoryId: string) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.voiceSettings(factoryId),
    queryFn: () => client.get<VoiceSettingsResponse>(`/web/voice/settings?factoryId=${encodeURIComponent(factoryId)}`),
    select: fromResponse,
  });
}

export interface UpdateVoiceSettingsArgs {
  /** `personal` saves the caller's choice; `factory` saves the Factory's (org admins only). */
  target: 'personal' | 'factory';
  /** Absent clears the choice: personal follows the Factory, the Factory goes back to auto. */
  choice?: VoiceChoice;
}

/** The response is the refreshed settings, written straight into the cache. */
export function useUpdateVoiceSettings(factoryId: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ target, choice }: UpdateVoiceSettingsArgs) =>
      client.put<VoiceSettingsResponse>('/web/voice/settings', {
        target,
        factoryId,
        ...(choice ?? { provider: null }),
      }),
    onSuccess: res => queryClient.setQueryData(queryKeys.voiceSettings(factoryId), res),
  });
}
