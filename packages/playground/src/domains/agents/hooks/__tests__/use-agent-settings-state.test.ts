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

import { isAnthropicModelWithSamplingRestriction } from '../../utils/model-restrictions';

/**
 * Test file for use-agent-settings-state.ts
 *
 * Default settings should NOT include temperature or topP - these should be
 * left undefined so models use their provider defaults unless explicitly set.
 */
describe('use-agent-settings-state defaults', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should not have temperature or topP set by default (use model provider defaults)', async () => {
    const { defaultSettings } = await import('../use-agent-settings-state');

    const modelSettings = defaultSettings.modelSettings;

    // temperature and topP should be undefined to use model provider defaults
    // This also avoids Claude 4.5+ errors where both cannot be specified
    expect(modelSettings.temperature).toBeUndefined();
    expect(modelSettings.topP).toBeUndefined();
  });
});

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
