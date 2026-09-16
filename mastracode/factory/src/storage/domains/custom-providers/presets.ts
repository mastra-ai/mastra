import { getCustomProviderId } from '@mastra/code-sdk/onboarding/settings';

import type { CustomProviderRecord } from './base.js';

/**
 * An OpenAI-compatible provider configured on the deployment rather than by an
 * org. Presets are listed for every org, read-only, alongside the org's own
 * custom providers.
 */
export interface CustomProviderPreset {
  /** Display name. The provider id is its slug (`getCustomProviderId`). */
  name: string;
  /** OpenAI-compatible base URL, e.g. `https://llm.example.com/v1`. */
  url: string;
  apiKey?: string;
  /**
   * Model ids. Omitted → discovered from `GET {url}/models` and refreshed
   * periodically, so a proxy that fronts many models needs no static list.
   */
  models?: string[];
}

/** How long a discovered model list is served before it is refetched. */
const DISCOVERY_TTL_MS = 5 * 60_000;
const DISCOVERY_TIMEOUT_MS = 10_000;

interface PresetState {
  preset: CustomProviderPreset;
  providerId: string;
  models: string[];
  fetchedAt: number;
  discovering?: Promise<void>;
}

/**
 * Deployment presets and their model lists. Presets with a static `models`
 * list never hit the network; the rest are discovered from the provider's
 * `/models` endpoint, cached per preset, and kept at the last good list when
 * a refresh fails.
 */
export class CustomProviderPresets {
  readonly #states: PresetState[];
  readonly #createdAt = new Date();
  readonly #fetch: typeof fetch;

  constructor(presets: CustomProviderPreset[], fetchImpl: typeof fetch = fetch) {
    this.#fetch = fetchImpl;
    this.#states = presets.map(preset => ({
      preset,
      providerId: getCustomProviderId(preset.name),
      models: preset.models ?? [],
      fetchedAt: preset.models ? Number.POSITIVE_INFINITY : 0,
    }));
  }

  has(providerId: string): boolean {
    return this.#states.some(state => state.providerId === providerId);
  }

  /** Preset rows shaped like the org's own records, models discovered when due. */
  async records(orgId: string): Promise<CustomProviderRecord[]> {
    await Promise.all(this.#states.map(state => this.#ensureModels(state)));
    return this.#states.map(state => ({
      id: `preset:${state.providerId}`,
      orgId,
      createdBy: 'preset',
      providerId: state.providerId,
      name: state.preset.name,
      url: state.preset.url,
      apiKey: state.preset.apiKey ?? null,
      models: state.models,
      createdAt: this.#createdAt,
      updatedAt: this.#createdAt,
      preset: true,
    }));
  }

  async #ensureModels(state: PresetState, now = Date.now()): Promise<void> {
    if (now - state.fetchedAt < DISCOVERY_TTL_MS) return;
    state.discovering ??= this.#discover(state).finally(() => {
      state.discovering = undefined;
    });
    await state.discovering;
  }

  async #discover(state: PresetState): Promise<void> {
    try {
      const res = await this.#fetch(`${state.preset.url.replace(/\/+$/, '')}/models`, {
        headers: state.preset.apiKey ? { Authorization: `Bearer ${state.preset.apiKey}` } : {},
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data?: { id?: unknown }[] };
      const models = (body.data ?? []).map(m => m.id).filter((id): id is string => typeof id === 'string');
      state.models = models.sort();
      state.fetchedAt = Date.now();
    } catch (error) {
      // Keep serving the last good list; retry on the next read.
      console.warn(
        `[factory] Could not list models for custom provider "${state.preset.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
