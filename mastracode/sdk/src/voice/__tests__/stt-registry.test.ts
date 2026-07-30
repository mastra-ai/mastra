import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STT_MODEL,
  DEFAULT_STT_PROVIDER,
  defaultModelForProvider,
  resolveSTTModel,
  STT_MODELS,
  sttModelsForProvider,
  sttProviders,
} from '../stt-registry.js';

type Snapshot = Record<
  string,
  {
    name?: string;
    npm?: string;
    api?: string;
    models: Record<string, { modalities: { input: string[]; output: string[] } }>;
  }
>;

function loadSnapshot(): Snapshot {
  const url = new URL('./fixtures/models-dev-stt-snapshot.json', import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as Snapshot;
}

/**
 * Providers we deliberately do not surface in the picker, with a reason. These
 * appear in the models.dev STT snapshot but are intentionally excluded:
 * - `vercel`: AI Gateway that re-exposes openai/xai STT; we list the direct
 *   `openai` provider instead so users authenticate with their own key.
 * - `privatemode-ai`: localhost-only endpoint, not usable as a hosted default.
 */
const INTENTIONALLY_EXCLUDED = new Set(['vercel', 'privatemode-ai']);

describe('stt-registry', () => {
  it('covers every directly-hosted STT model from the models.dev snapshot', () => {
    const snapshot = loadSnapshot();
    const registryKeys = new Set(STT_MODELS.map(m => `${m.provider}/${m.model}`));

    const missing: string[] = [];
    for (const [provider, info] of Object.entries(snapshot)) {
      if (INTENTIONALLY_EXCLUDED.has(provider)) continue;
      for (const model of Object.keys(info.models)) {
        if (!registryKeys.has(`${provider}/${model}`)) {
          missing.push(`${provider}/${model}`);
        }
      }
    }

    expect(missing, `STT models in models.dev but missing from the registry: ${missing.join(', ')}`).toEqual([]);
  });

  it('points openai-compatible entries at the models.dev base URL', () => {
    const snapshot = loadSnapshot();
    for (const entry of STT_MODELS) {
      if (entry.resolver !== 'openai-compatible') continue;
      expect(entry.baseURL, `${entry.provider} should have a baseURL`).toBeTruthy();
      const snap = snapshot[entry.provider];
      if (snap?.api) {
        expect(entry.baseURL).toBe(snap.api);
      }
    }
  });

  it('only uses the bare openai resolver for the openai provider', () => {
    for (const entry of STT_MODELS) {
      if (entry.resolver === 'openai') {
        expect(entry.provider).toBe('openai');
        expect(entry.baseURL).toBeUndefined();
      }
    }
  });

  it('routes groq through its OpenAI-compatible endpoint', () => {
    const groq = sttModelsForProvider('groq');
    expect(groq.length).toBeGreaterThan(0);
    for (const entry of groq) {
      expect(entry.resolver).toBe('openai-compatible');
      expect(entry.baseURL).toBe('https://api.groq.com/openai/v1');
    }
  });

  it('includes Deepgram as a dedicated (non-OpenAI-compatible) provider', () => {
    const deepgram = sttModelsForProvider('deepgram');
    expect(deepgram.length).toBeGreaterThan(0);
    for (const entry of deepgram) {
      expect(entry.resolver).toBe('deepgram');
      // Deepgram uses its own SDK, not an OpenAI-compatible baseURL.
      expect(entry.baseURL).toBeUndefined();
    }
    expect(defaultModelForProvider('deepgram')?.model).toBe('nova-3');
  });

  it('does not require Deepgram to appear in the models.dev snapshot', () => {
    // Deepgram is added deliberately; it is not in the models.dev STT snapshot.
    const snapshot = loadSnapshot();
    expect(snapshot.deepgram).toBeUndefined();
    expect(sttProviders()).toContain('deepgram');
  });

  it('defaults to OpenAI whisper-1', () => {
    expect(DEFAULT_STT_PROVIDER).toBe('openai');
    expect(DEFAULT_STT_MODEL.model).toBe('whisper-1');
  });

  it('lists providers in registry order without duplicates', () => {
    const providers = sttProviders();
    expect(new Set(providers).size).toBe(providers.length);
    expect(providers[0]).toBe('openai');
    expect(providers).toContain('groq');
  });

  it('returns the first model for a provider as its default', () => {
    expect(defaultModelForProvider('groq')?.model).toBe('whisper-large-v3-turbo');
    expect(sttModelsForProvider('groq').map(m => m.model)).toEqual(['whisper-large-v3-turbo', 'whisper-large-v3']);
    expect(defaultModelForProvider('nope')).toBeUndefined();
  });

  describe('resolveSTTModel', () => {
    it('returns an exact match when provider+model are known', () => {
      const m = resolveSTTModel('groq', 'whisper-large-v3');
      expect(m.provider).toBe('groq');
      expect(m.model).toBe('whisper-large-v3');
    });

    it('falls back to the provider default for an unknown model', () => {
      const m = resolveSTTModel('groq', 'made-up');
      expect(m.model).toBe('whisper-large-v3-turbo');
    });

    it('falls back to the global default for an unknown provider', () => {
      const m = resolveSTTModel('made-up', 'made-up');
      expect(m).toEqual(DEFAULT_STT_MODEL);
    });

    it('falls back to the global default with no arguments', () => {
      expect(resolveSTTModel()).toEqual(DEFAULT_STT_MODEL);
    });
  });
});
