import { describe, expect, it } from 'vitest';

import {
  defaultModelPack,
  legacyModelPackSet,
  parseStoredModelSelection,
  resolveModelSelection,
  withDefaultModel,
} from './model-packs.js';
import type { ModelPack, ModelPackSet } from './model-packs.js';

const build: ModelPack = {
  id: 'build',
  name: 'Build',
  models: [
    { modelId: 'anthropic/claude-opus-5.5', thinkingLevel: 'medium' },
    { modelId: 'openai/gpt-5.6-sol', thinkingLevel: 'high' },
    { modelId: 'qwen/qwen3.8', thinkingLevel: 'medium' },
  ],
};

const cheap: ModelPack = {
  id: 'cheap',
  name: 'Cheap',
  models: [
    { modelId: 'deepseek/deepseek-flash', thinkingLevel: 'low' },
    { modelId: 'google/gemini-3.8-flash', thinkingLevel: 'off' },
  ],
};

const packs: ModelPackSet = { modelPacks: [build, cheap], defaultModelPackId: 'build' };

describe('resolveModelSelection', () => {
  it('runs the exact model whenever the session picked one', () => {
    expect(resolveModelSelection(packs, { kind: 'model' }, 'anthropic/claude-opus-5.5')).toEqual({ kind: 'model' });
  });

  it('runs the picked pack whatever model the session currently shows', () => {
    expect(resolveModelSelection(packs, { kind: 'pack', packId: 'cheap' }, 'openai/gpt-5.6-sol')).toEqual({
      kind: 'pack',
      pack: cheap,
    });
  });

  it('runs the default pack when the picked pack was deleted', () => {
    expect(resolveModelSelection(packs, { kind: 'pack', packId: 'deleted' }, undefined)).toEqual({
      kind: 'pack',
      pack: build,
    });
  });

  it('follows whichever pack is the default', () => {
    expect(resolveModelSelection({ ...packs, defaultModelPackId: 'cheap' }, { kind: 'default' }, undefined)).toEqual({
      kind: 'pack',
      pack: cheap,
    });
  });

  it('runs the exact model when no default pack exists', () => {
    const empty = legacyModelPackSet(null, 'medium');
    expect(resolveModelSelection(empty, { kind: 'default' }, 'anthropic/claude-opus-5.5')).toEqual({ kind: 'model' });
    expect(resolveModelSelection(empty, { kind: 'pack', packId: 'cheap' }, undefined)).toEqual({ kind: 'model' });
  });

  it('reads an unset selection as the default pack only while the session runs its first model', () => {
    expect(resolveModelSelection(packs, undefined, 'anthropic/claude-opus-5.5')).toEqual({ kind: 'pack', pack: build });
    expect(resolveModelSelection(packs, undefined, 'deepseek/deepseek-flash')).toEqual({ kind: 'model' });
    expect(resolveModelSelection(packs, undefined, undefined)).toEqual({ kind: 'model' });
  });
});

describe('parseStoredModelSelection', () => {
  it('accepts the stored shapes and rejects anything else', () => {
    expect(parseStoredModelSelection({ kind: 'pack', packId: 'cheap' })).toEqual({ kind: 'pack', packId: 'cheap' });
    expect(parseStoredModelSelection({ kind: 'default' })).toEqual({ kind: 'default' });
    expect(parseStoredModelSelection({ kind: 'model' })).toEqual({ kind: 'model' });
    expect(parseStoredModelSelection('cheap')).toBeUndefined();
    expect(parseStoredModelSelection({ kind: 'pack' })).toBeUndefined();
    expect(parseStoredModelSelection(undefined)).toBeUndefined();
  });
});

describe('legacyModelPackSet', () => {
  it('turns a legacy default model into a single Default pack', () => {
    expect(legacyModelPackSet('anthropic/claude-opus-5.5', 'high')).toEqual({
      modelPacks: [
        { id: 'default', name: 'Default', models: [{ modelId: 'anthropic/claude-opus-5.5', thinkingLevel: 'high' }] },
      ],
      defaultModelPackId: 'default',
    });
    expect(legacyModelPackSet(null, 'high')).toEqual({ modelPacks: [], defaultModelPackId: null });
  });
});

describe('withDefaultModel', () => {
  it('replaces the default pack first model and keeps its fallbacks and thinking level', () => {
    const next = withDefaultModel(packs, { modelId: 'moonshot/kimi-k3' }, 'low');
    expect(defaultModelPack(next)?.models).toEqual([
      { modelId: 'moonshot/kimi-k3', thinkingLevel: 'medium' },
      build.models[1],
      build.models[2],
    ]);
    expect(next.modelPacks[1]).toBe(cheap);
  });

  it('drops a fallback that becomes the first model', () => {
    const next = withDefaultModel(packs, { modelId: 'openai/gpt-5.6-sol' }, 'low');
    expect(defaultModelPack(next)?.models).toEqual([
      { modelId: 'openai/gpt-5.6-sol', thinkingLevel: 'medium' },
      build.models[2],
    ]);
  });

  it('creates a Default pack when the owner has no packs', () => {
    const empty = legacyModelPackSet(null, 'medium');
    expect(withDefaultModel(empty, { modelId: 'anthropic/claude-opus-5.5' }, 'low')).toEqual(
      legacyModelPackSet('anthropic/claude-opus-5.5', 'low'),
    );
    expect(withDefaultModel(empty, { modelId: 'anthropic/claude-opus-5.5', thinkingLevel: 'max' }, 'low')).toEqual(
      legacyModelPackSet('anthropic/claude-opus-5.5', 'max'),
    );
  });

  it('removes the default pack and promotes the first remaining pack', () => {
    expect(withDefaultModel(packs, { modelId: null }, 'low')).toEqual({
      modelPacks: [cheap],
      defaultModelPackId: 'cheap',
    });
    expect(withDefaultModel({ modelPacks: [build], defaultModelPackId: 'build' }, { modelId: null }, 'low')).toEqual({
      modelPacks: [],
      defaultModelPackId: null,
    });
  });

  it('sets the default pack first thinking level only', () => {
    const next = withDefaultModel(packs, { thinkingLevel: 'xhigh' }, 'low');
    expect(defaultModelPack(next)?.models).toEqual([
      { modelId: 'anthropic/claude-opus-5.5', thinkingLevel: 'xhigh' },
      build.models[1],
      build.models[2],
    ]);
  });

  it('leaves an empty set unchanged when only the thinking level changes', () => {
    const empty = legacyModelPackSet(null, 'medium');
    expect(withDefaultModel(empty, { thinkingLevel: 'high' }, 'low')).toEqual(empty);
  });
});
