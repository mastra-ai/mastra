import { describe, expect, it } from 'vitest';
import { buildAgentDefaultSettings } from '../agent-default-settings';

describe('buildAgentDefaultSettings', () => {
  it('returns empty model settings when agent is missing', () => {
    expect(buildAgentDefaultSettings(null)).toEqual({ modelSettings: {} });
    expect(buildAgentDefaultSettings(undefined)).toEqual({ modelSettings: {} });
  });

  it('returns empty model settings when agent has no defaultOptions', () => {
    expect(buildAgentDefaultSettings({})).toEqual({ modelSettings: {} });
  });

  it('maps maxOutputTokens to maxTokens', () => {
    const result = buildAgentDefaultSettings({
      defaultOptions: { modelSettings: { maxOutputTokens: 1024 } },
    });

    expect(result.modelSettings.maxTokens).toBe(1024);
    expect(result.modelSettings).not.toHaveProperty('maxOutputTokens');
  });

  it('passes through other model settings unchanged', () => {
    const result = buildAgentDefaultSettings({
      defaultOptions: { modelSettings: { temperature: 0.7, topP: 0.9 } },
    });

    expect(result.modelSettings).toEqual({ temperature: 0.7, topP: 0.9 });
  });

  it('only includes maxSteps and providerOptions when defined', () => {
    const withValues = buildAgentDefaultSettings({
      defaultOptions: { maxSteps: 10, providerOptions: { openai: { reasoningEffort: 'low' } } },
    });
    expect(withValues.modelSettings.maxSteps).toBe(10);
    expect(withValues.modelSettings.providerOptions).toEqual({ openai: { reasoningEffort: 'low' } });

    const withoutValues = buildAgentDefaultSettings({ defaultOptions: { modelSettings: {} } });
    expect(withoutValues.modelSettings).not.toHaveProperty('maxSteps');
    expect(withoutValues.modelSettings).not.toHaveProperty('providerOptions');
    expect(withoutValues.modelSettings).not.toHaveProperty('maxTokens');
  });
});
