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
 * Issue #11760: Anthropic models fail when both temperature and topP are sent.
 * Anthropic's API returns: "`temperature` and `top_p` cannot both be specified for this model."
 *
 * The root cause is the default settings in use-agent-settings-state.ts which set:
 * - temperature: 0.5
 * - topP: 1
 *
 * This causes every agent call from the playground to include both values,
 * breaking Anthropic model compatibility.
 */
describe('use-agent-settings-state defaults', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should NOT have both temperature and topP set by default (Anthropic compatibility)', async () => {
    // Import the module to get the default settings
    // We're testing the module's exported default behavior
    const { defaultSettings } = await import('../use-agent-settings-state');

    const modelSettings = defaultSettings.modelSettings;

    // Both temperature and topP should NOT both be defined
    // as this breaks Anthropic models which don't allow both to be specified
    const hasBothDefined = modelSettings.temperature !== undefined && modelSettings.topP !== undefined;

    expect(hasBothDefined).toBe(false);
  });

  it('should allow temperature OR topP to be set individually', async () => {
    const { defaultSettings } = await import('../use-agent-settings-state');

    const modelSettings = defaultSettings.modelSettings;

    // At most one of temperature or topP should be defined by default
    const definedCount = [modelSettings.temperature, modelSettings.topP].filter(v => v !== undefined).length;

    expect(definedCount).toBeLessThanOrEqual(1);
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
