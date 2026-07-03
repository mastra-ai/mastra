import type { Provider } from '@mastra/client-js';

export type DesktopRuntimeStateValue = 'idle' | 'starting' | 'running' | 'stopped' | 'error';
export type DesktopLocalModelProviderId = 'lmstudio' | 'ollama' | 'local';
export type DesktopProbeProviderId = 'lmstudio' | 'ollama' | 'custom';

export interface DesktopRuntimeSettings {
  modelUrl: string;
  modelId: string;
  modelApiKey: string;
  environmentVariables: Record<string, string>;
}

export interface DesktopRuntimeState {
  runtime: {
    state: DesktopRuntimeStateValue;
    url?: string;
    error?: string;
  };
  settings: DesktopRuntimeSettings;
}

export interface ProbeModelsResult {
  ok: boolean;
  modelUrl: string;
  models: string[];
  error?: string;
}

export interface UpdateSettingsResult {
  settings: DesktopRuntimeSettings;
  state: DesktopRuntimeState;
}

const DESKTOP_LOCAL_PROVIDERS: Record<
  DesktopLocalModelProviderId,
  {
    id: string;
    name: string;
    probeProviderId: DesktopProbeProviderId;
  }
> = {
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio Local',
    probeProviderId: 'lmstudio',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama Local',
    probeProviderId: 'ollama',
  },
  local: {
    id: 'local',
    name: 'Local Model Server',
    probeProviderId: 'custom',
  },
};

function normalizedModelUrl(modelUrl: string) {
  return modelUrl.trim().replace(/\/$/, '').toLowerCase();
}

export function desktopEndpoint() {
  const endpoint = window.MASTRA_DESKTOP_ENDPOINT?.trim();
  return endpoint ? endpoint.replace(/\/$/, '') : undefined;
}

export function desktopUrl(endpoint: string, path: string) {
  return `${endpoint}${path}`;
}

export async function desktopRequest<TResponse>(
  endpoint: string,
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(desktopUrl(endpoint, path), {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : init?.headers,
  });

  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const error =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Desktop request failed with ${response.status}`;
    throw new Error(error);
  }
  return body as TResponse;
}

export function desktopLocalProviderIdForModelUrl(modelUrl: string): DesktopLocalModelProviderId {
  const normalized = normalizedModelUrl(modelUrl);
  if (normalized === 'http://localhost:11434/v1' || normalized === 'http://127.0.0.1:11434/v1') return 'ollama';
  if (normalized === 'http://localhost:1234/v1' || normalized === 'http://127.0.0.1:1234/v1') return 'lmstudio';
  return 'local';
}

export function desktopProbeProviderIdForModelUrl(modelUrl: string): DesktopProbeProviderId {
  return DESKTOP_LOCAL_PROVIDERS[desktopLocalProviderIdForModelUrl(modelUrl)].probeProviderId;
}

export function desktopProviderNameForModelUrl(modelUrl: string) {
  return DESKTOP_LOCAL_PROVIDERS[desktopLocalProviderIdForModelUrl(modelUrl)].name;
}

export function buildDesktopLocalProvider({
  probe,
  state,
}: {
  probe?: ProbeModelsResult;
  state?: DesktopRuntimeState;
}): Provider | undefined {
  const settings = state?.settings;
  if (!settings?.modelUrl.trim()) return undefined;
  if (probe && !probe.ok) return undefined;

  const providerConfig = DESKTOP_LOCAL_PROVIDERS[desktopLocalProviderIdForModelUrl(settings.modelUrl)];
  const models =
    probe?.ok && probe.models.length > 0 ? probe.models : settings.modelId.trim() ? [settings.modelId] : [];
  const uniqueModels = Array.from(new Set(models.map(model => model.trim()).filter(Boolean)));

  if (uniqueModels.length === 0) return undefined;

  return {
    id: providerConfig.id,
    name: providerConfig.name,
    envVar: 'MASTRA_DESKTOP_MODEL_API_KEY',
    connected: true,
    models: uniqueModels,
  };
}
