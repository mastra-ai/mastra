import { useEffect, useEffectEvent } from 'react';
import { AgentSettingsType as AgentSettings } from '@/types';
import { isAnthropicModelWithSamplingRestriction } from '../utils/model-restrictions';

export interface UseSamplingRestrictionProps {
  provider: string | undefined;
  modelId: string | undefined;
  settings: AgentSettings | undefined;
  setSettings: (settings: AgentSettings) => void;
}

/**
 * For models with sampling restriction (Claude 4.5+), auto-clear topP if both
 * temperature and topP are set. This handles users who have both values from
 * localStorage or defaults.
 */
export function useSamplingRestriction({ provider, modelId, settings, setSettings }: UseSamplingRestrictionProps) {
  const hasSamplingRestriction = isAnthropicModelWithSamplingRestriction(provider, modelId);

  const clearTopP = useEffectEvent(() => {
    setSettings({
      ...settings,
      modelSettings: { ...settings?.modelSettings, topP: undefined },
    });
  });

  const agentModelKey = provider && modelId ? `${provider}-${modelId}` : undefined;
  const topP = settings?.modelSettings?.topP;
  const temperature = settings?.modelSettings?.temperature;

  useEffect(() => {
    if (!hasSamplingRestriction) return;
    if (!agentModelKey) return;
    if (topP === undefined || temperature === undefined) return;

    clearTopP();
  }, [hasSamplingRestriction, agentModelKey, topP, temperature]);

  return { hasSamplingRestriction };
}
