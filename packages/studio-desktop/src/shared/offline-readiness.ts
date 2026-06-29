import type { ProbeModelsResult, RuntimeStatus } from './types';

export type OfflineReadinessVariant = 'success' | 'warning' | 'error' | 'neutral';

export interface OfflineReadiness {
  label: string;
  message: string;
  variant: OfflineReadinessVariant;
}

export interface OfflineReadinessInput {
  isLocalModelApplied: boolean;
  modelProbe: ProbeModelsResult | undefined;
  providerName: string;
  runtimeState: RuntimeStatus['state'];
}

export function getOfflineReadiness({
  isLocalModelApplied,
  modelProbe,
  providerName,
  runtimeState,
}: OfflineReadinessInput): OfflineReadiness {
  const provider = providerName.trim() || 'local model server';

  if (runtimeState !== 'running') {
    return {
      label: 'Start runtime',
      message: 'Open the bundled template to start the local Mastra runtime.',
      variant: 'neutral',
    };
  }

  if (!isLocalModelApplied) {
    return {
      label: 'Apply model',
      message: `Apply these ${provider} settings and restart the local runtime.`,
      variant: 'neutral',
    };
  }

  if (!modelProbe) {
    return {
      label: 'Probe model',
      message: `Probe ${provider} to confirm the local model is available offline.`,
      variant: 'neutral',
    };
  }

  if (!modelProbe.ok) {
    return {
      label: 'Model offline',
      message: `Start ${provider}, load a model, then probe again.`,
      variant: 'error',
    };
  }

  if (modelProbe.models.length === 0) {
    return {
      label: 'Load model',
      message: `${provider} is reachable, but it did not report a loaded model.`,
      variant: 'warning',
    };
  }

  return {
    label: 'Offline ready',
    message: `Ready for offline local Studio with ${provider}. Internet is not required for this local runtime.`,
    variant: 'success',
  };
}
