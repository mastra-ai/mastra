import type { IAgentBuilder } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';
import { describe, expect, it, vi } from 'vitest';
import { resolveBuilderModelPolicy, resolveModelPolicy } from './resolve-model-policy';

const editor = (overrides: Partial<IMastraEditor>): IMastraEditor => overrides as IMastraEditor;

const happyBuilder: IAgentBuilder = {
  enabled: true,
  getFeatures: () => ({ agent: { model: true } }),
  getConfiguration: () => ({
    agent: {
      models: {
        default: { provider: 'openai', modelId: 'gpt-4o' },
      },
    },
  }),
};

describe('resolveModelPolicy (builder surface)', () => {
  it('returns inactive when editor is undefined', async () => {
    expect(await resolveModelPolicy({ editor: undefined, surface: 'builder' })).toEqual({ active: false });
  });

  it('returns inactive when editor lacks resolveBuilder', async () => {
    expect(await resolveModelPolicy({ editor: editor({}), surface: 'builder' })).toEqual({ active: false });
  });

  it('returns inactive when hasEnabledBuilderConfig returns false (and skips resolveBuilder)', async () => {
    const resolveBuilder = vi.fn();
    const result = await resolveModelPolicy({
      editor: editor({
        hasEnabledBuilderConfig: () => false,
        resolveBuilder,
      }),
      surface: 'builder',
    });
    expect(result).toEqual({ active: false });
    expect(resolveBuilder).not.toHaveBeenCalled();
  });

  it('returns inactive when resolveBuilder returns undefined', async () => {
    const result = await resolveModelPolicy({
      editor: editor({
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(undefined),
      }),
      surface: 'builder',
    });
    expect(result).toEqual({ active: false });
  });

  it('returns inactive when builder.enabled is false', async () => {
    const builder: IAgentBuilder = {
      enabled: false,
      getFeatures: () => ({ agent: { model: true } }),
      getConfiguration: () => ({}),
    };
    const result = await resolveModelPolicy({
      editor: editor({
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(builder),
      }),
      surface: 'builder',
    });
    expect(result).toEqual({ active: false });
  });

  it('falls through to builderToModelPolicy in the happy path', async () => {
    const result = await resolveModelPolicy({
      editor: editor({
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(happyBuilder),
      }),
      surface: 'builder',
    });
    expect(result).toEqual({
      active: true,
      pickerVisible: true,
      default: { provider: 'openai', modelId: 'gpt-4o' },
    });
  });

  it('returns inactive when resolveBuilder rejects (does not throw)', async () => {
    const result = await resolveModelPolicy({
      editor: editor({
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockRejectedValue(new Error('builder boom')),
      }),
      surface: 'builder',
    });
    expect(result).toEqual({ active: false });
  });

  it('treats a missing hasEnabledBuilderConfig as "skip the gate"', async () => {
    const builder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { model: true } }),
      getConfiguration: () => ({}),
    };
    const result = await resolveModelPolicy({
      editor: editor({
        resolveBuilder: vi.fn().mockResolvedValue(builder),
      }),
      surface: 'builder',
    });
    expect(result).toEqual({ active: true, pickerVisible: true });
  });
});

describe('resolveModelPolicy (editor surface)', () => {
  it('always returns inactive regardless of editor', async () => {
    expect(await resolveModelPolicy({ editor: undefined, surface: 'editor' })).toEqual({ active: false });
  });

  it('does not consult the builder even when configured', async () => {
    const resolveBuilder = vi.fn().mockResolvedValue(happyBuilder);
    const result = await resolveModelPolicy({
      editor: editor({
        hasEnabledBuilderConfig: () => true,
        resolveBuilder,
      }),
      surface: 'editor',
    });
    expect(result).toEqual({ active: false });
    expect(resolveBuilder).not.toHaveBeenCalled();
  });
});

describe('resolveBuilderModelPolicy (deprecated alias)', () => {
  it('routes to the builder surface', async () => {
    const result = await resolveBuilderModelPolicy(
      editor({
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(happyBuilder),
      }),
    );
    expect(result).toEqual({
      active: true,
      pickerVisible: true,
      default: { provider: 'openai', modelId: 'gpt-4o' },
    });
  });

  it('returns inactive when editor is undefined', async () => {
    expect(await resolveBuilderModelPolicy(undefined)).toEqual({ active: false });
  });
});
