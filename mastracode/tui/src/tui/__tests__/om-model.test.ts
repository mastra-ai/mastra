import type { Session } from '@mastra/core/agent-controller';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getEffectiveOMRoleModelId } from '../om-model.js';

function session(observerModelId: string, memoryModelId?: string) {
  const state = {
    modelRoute: {
      entries: [
        {
          id: 'custom:Work',
          label: 'Work',
          modelId: 'anthropic/claude-fable-5',
          ...(memoryModelId ? { memoryModelId } : {}),
        },
      ],
    },
  };
  return {
    state: { get: () => state },
    thread: { getId: () => 'thread-1' },
    model: { get: () => 'anthropic/claude-sonnet-4-6' },
    om: { observer: { modelId: () => observerModelId }, reflector: { modelId: () => observerModelId } },
  } as unknown as Session<any>;
}

describe('getEffectiveOMRoleModelId', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    return () => vi.unstubAllEnvs();
  });

  it('reports the /om role model when the active route leaves memory unset', () => {
    expect(getEffectiveOMRoleModelId(session('openai/gpt-5.4-mini'), 'observer')).toBe('openai/gpt-5.4-mini');
  });

  it("reports the active route's memory model over a pinned role", () => {
    expect(getEffectiveOMRoleModelId(session('openai/gpt-5.4-mini', 'deepseek/deepseek-v4-flash'), 'observer')).toBe(
      'deepseek/deepseek-v4-flash',
    );
  });

  it('reports the automatic model when the active route sets memory to Auto', () => {
    expect(getEffectiveOMRoleModelId(session('openai/gpt-5.4-mini', 'auto'), 'reflector')).toBe(
      'anthropic/claude-haiku-4-5',
    );
  });
});
