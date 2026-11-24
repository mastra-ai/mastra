import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectorOptions: undefined as any,
}));

vi.mock('../../components/model-selector.js', () => ({
  ModelSelectorComponent: class {
    focused = false;
    constructor(options: any) {
      mocks.selectorOptions = options;
    }
  },
}));
vi.mock('../../overlay.js', () => ({ showModalOverlay: vi.fn() }));
vi.mock('../../prompt-api-key.js', () => ({ promptForApiKeyIfNeeded: vi.fn() }));

import { selectModel } from '../models-pack.js';

const sol = { id: 'openai/gpt-6.2-sol', provider: 'openai', modelName: 'gpt-6.2-sol', hasApiKey: true };
const mini = { id: 'openai/gpt-5.4-mini', provider: 'openai', modelName: 'gpt-5.4-mini', hasApiKey: true };
const claude = {
  id: 'anthropic/claude-opus-5-5',
  provider: 'anthropic',
  modelName: 'claude-opus-5-5',
  hasApiKey: true,
};
const unconnectedSol = { ...sol, id: 'vercel/openai/gpt-6.2-sol', provider: 'vercel', hasApiKey: false };

async function pickerIdsFor(credential: { type: 'oauth' } | { type: 'api_key'; key: string } | undefined) {
  const ctx = {
    authStorage: { get: (provider: string) => (provider === 'openai-codex' ? credential : undefined) },
    state: {
      ui: {},
      factory: undefined,
      controller: { listAvailableModels: async () => [claude, sol, mini, unconnectedSol] },
    },
  } as any;
  void selectModel(ctx, 'Select model for plan mode');
  await vi.waitFor(() => expect(mocks.selectorOptions).toBeDefined());
  return (mocks.selectorOptions.models as Array<{ id: string }>).map(model => model.id);
}

describe('selectModel (the model picker used when a pack is created or edited)', () => {
  beforeEach(() => {
    mocks.selectorOptions = undefined;
  });

  it('offers a Fast entry for each connected OpenAI model that has Fast when signed in with ChatGPT', async () => {
    const ids = await pickerIdsFor({ type: 'oauth' });

    expect(ids).toContain('openai/gpt-6.2-sol:fast');
    expect(ids).not.toContain('openai/gpt-5.4-mini:fast');
    expect(ids).not.toContain('vercel/openai/gpt-6.2-sol:fast');
  });

  it('offers no Fast entries without a ChatGPT sign-in', async () => {
    const ids = await pickerIdsFor({ type: 'api_key', key: 'sk-test' });

    expect(ids.some(id => id.endsWith(':fast'))).toBe(false);
  });
});
