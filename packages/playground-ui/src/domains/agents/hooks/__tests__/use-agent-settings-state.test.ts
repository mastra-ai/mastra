import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

/**
 * Test file for use-agent-settings-state.ts
 *
 * Issue #11760: Anthropic Claude 4.5+ models fail when both temperature and topP are sent.
 * Anthropic's API returns: "`temperature` and `top_p` cannot both be specified for this model."
 *
 * Default settings include both temperature and topP for models that support both (OpenAI, Google, Claude 3.5).
 * For Claude 4.5+ models, the AgentSettings component auto-clears topP when the model is detected.
 */
describe('use-agent-settings-state defaults', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should have both temperature and topP set by default (for models that support both)', async () => {
    const { defaultSettings } = await import('../use-agent-settings-state');

    const modelSettings = defaultSettings.modelSettings;

    // Defaults should include both values for models that support them
    // (OpenAI, Google, Claude 3.5, etc.)
    // Claude 4.5+ models will have topP auto-cleared at the component level
    expect(modelSettings.temperature).toBe(0.5);
    expect(modelSettings.topP).toBe(1);
  });
});

// Inline the function for testing (since it's not exported from agent-settings.tsx)
function isAnthropicModelWithSamplingRestriction(provider?: string, modelId?: string): boolean {
  if (!provider) return false;
  const cleanProvider = provider.includes('.') ? provider.split('.')[0] : provider;
  if (cleanProvider.toLowerCase() !== 'anthropic') return false;

  if (!modelId) return true;
  const lowerModelId = modelId.toLowerCase();

  // Check for version 4.5+ patterns specifically
  // Must match version 4.5 or higher (4-5, 4.5, 5-0, 5.0, etc.)
  // But NOT match 3-5 or 3.5 (Claude 3.5 Sonnet, etc.)
  const is45OrNewer =
    /[^0-9]4[.-]5/.test(lowerModelId) || // Matches 4-5 or 4.5 but not 34-5
    /[^0-9][5-9][.-]\d/.test(lowerModelId); // Matches 5-0, 6-0, etc. for future versions

  return is45OrNewer;
}

describe('isAnthropicModelWithSamplingRestriction', () => {
  it('should return false for non-Anthropic providers', () => {
    expect(isAnthropicModelWithSamplingRestriction('openai', 'gpt-4')).toBe(false);
    expect(isAnthropicModelWithSamplingRestriction('google', 'gemini-pro')).toBe(false);
    expect(isAnthropicModelWithSamplingRestriction('openai.chat', 'gpt-4-turbo')).toBe(false);
  });

  it('should return true for Claude 4.5+ models', () => {
    expect(isAnthropicModelWithSamplingRestriction('anthropic', 'claude-haiku-4-5')).toBe(true);
    expect(isAnthropicModelWithSamplingRestriction('anthropic', 'claude-sonnet-4-5')).toBe(true);
    expect(isAnthropicModelWithSamplingRestriction('anthropic.messages', 'claude-4-5-sonnet')).toBe(true);
    expect(isAnthropicModelWithSamplingRestriction('anthropic', 'claude-opus-4-5')).toBe(true);
  });

  it('should return false for older Claude models (3.5 and earlier)', () => {
    expect(isAnthropicModelWithSamplingRestriction('anthropic', 'claude-3-5-sonnet')).toBe(false);
    expect(isAnthropicModelWithSamplingRestriction('anthropic', 'claude-3-opus')).toBe(false);
    expect(isAnthropicModelWithSamplingRestriction('anthropic', 'claude-3-haiku')).toBe(false);
    expect(isAnthropicModelWithSamplingRestriction('anthropic', 'claude-2')).toBe(false);
    expect(isAnthropicModelWithSamplingRestriction('anthropic', 'claude-instant')).toBe(false);
  });

  it('should return true for Anthropic with no modelId (default to restricted)', () => {
    expect(isAnthropicModelWithSamplingRestriction('anthropic', undefined)).toBe(true);
    expect(isAnthropicModelWithSamplingRestriction('anthropic.messages', undefined)).toBe(true);
  });

  it('should return false for undefined/null provider', () => {
    expect(isAnthropicModelWithSamplingRestriction(undefined, 'claude-4-5')).toBe(false);
    expect(isAnthropicModelWithSamplingRestriction('', 'claude-4-5')).toBe(false);
  });
});
