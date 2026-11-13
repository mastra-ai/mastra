import { describe, expect, it } from 'vitest';

import { PROVIDER_DEFAULT_MODELS } from '../../auth/storage.js';
import { buildMode } from './build.js';
import { planMode } from './plan.js';

// A session with an OpenAI credential keeps an `openai/*` mode default rather than
// falling back to the provider default, so the mode default must be a model that
// a ChatGPT (Codex OAuth) account can run.
describe('top-level mode default models', () => {
  it.each([buildMode, planMode])('$id mode starts on the Codex provider default', mode => {
    expect(mode.defaultModelId).toBe(PROVIDER_DEFAULT_MODELS['openai-codex']);
  });
});
