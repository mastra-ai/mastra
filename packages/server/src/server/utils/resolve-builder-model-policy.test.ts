import type { IAgentBuilder } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';
import { describe, expect, it, vi } from 'vitest';
import { resolveBuilderModelPolicy } from './resolve-builder-model-policy';

const editor = (overrides: Partial<IMastraEditor>): IMastraEditor => overrides as IMastraEditor;

describe('resolveBuilderModelPolicy', () => {
  it('returns inactive when editor is undefined', async () => {
    expect(await resolveBuilderModelPolicy(undefined)).toEqual({ active: false });
  });

  it('returns inactive when editor lacks resolveBuilder', async () => {
    expect(await resolveBuilderModelPolicy(editor({}))).toEqual({ active: false });
  });

  it('returns inactive when hasEnabledBuilderConfig returns false (and skips resolveBuilder)', async () => {
    const resolveBuilder = vi.fn();
    const result = await resolveBuilderModelPolicy(
      editor({
        hasEnabledBuilderConfig: () => false,
        resolveBuilder,
      }),
    );
    expect(result).toEqual({ active: false });
    expect(resolveBuilder).not.toHaveBeenCalled();
  });

  it('returns inactive when resolveBuilder returns undefined', async () => {
    const result = await resolveBuilderModelPolicy(
      editor({
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(undefined),
      }),
    );
    expect(result).toEqual({ active: false });
  });

  it('returns inactive when builder.enabled is false', async () => {
    const builder: IAgentBuilder = {
      enabled: false,
      getFeatures: () => ({ agent: { model: true } }),
      getConfiguration: () => ({}),
    };
    const result = await resolveBuilderModelPolicy(
      editor({
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(builder),
      }),
    );
    expect(result).toEqual({ active: false });
  });

  it('falls through to builderToModelPolicy in the happy path', async () => {
    const builder: IAgentBuilder = {
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
    const result = await resolveBuilderModelPolicy(
      editor({
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(builder),
      }),
    );
    expect(result).toEqual({
      active: true,
      pickerVisible: true,
      default: { provider: 'openai', modelId: 'gpt-4o' },
    });
  });

  it('returns inactive when resolveBuilder rejects (does not throw)', async () => {
    const result = await resolveBuilderModelPolicy(
      editor({
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockRejectedValue(new Error('builder boom')),
      }),
    );
    expect(result).toEqual({ active: false });
  });

  it('treats a missing hasEnabledBuilderConfig as "skip the gate"', async () => {
    const builder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { model: true } }),
      getConfiguration: () => ({}),
    };
    const result = await resolveBuilderModelPolicy(
      editor({
        // no hasEnabledBuilderConfig at all
        resolveBuilder: vi.fn().mockResolvedValue(builder),
      }),
    );
    expect(result).toEqual({ active: true, pickerVisible: true });
  });
});
