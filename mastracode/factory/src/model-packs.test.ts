import { describe, expect, it } from 'vitest';

import { activeModelPack, defaultModelPack, legacyModelPackSet, withDefaultModel } from './model-packs.js';
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

describe('activeModelPack', () => {
  it('uses the default pack while the session runs its first model', () => {
    expect(activeModelPack(packs, null, 'anthropic/claude-opus-5.5')).toBe(build);
  });

  it('uses the session pack over the default pack', () => {
    expect(activeModelPack(packs, 'cheap', 'deepseek/deepseek-flash')).toBe(cheap);
  });

  it('falls back to the default pack when the session pack no longer exists', () => {
    expect(activeModelPack(packs, 'deleted', 'anthropic/claude-opus-5.5')).toBe(build);
  });

  it('turns the pack off when the session runs a model that is not the pack first model', () => {
    expect(activeModelPack(packs, 'cheap', 'openai/gpt-5.6-sol')).toBeUndefined();
    expect(activeModelPack(packs, 'cheap', 'anthropic/claude-opus-5.5')).toBeUndefined();
    expect(activeModelPack(packs, null, undefined)).toBeUndefined();
  });

  it('has no active pack when there are no packs', () => {
    expect(activeModelPack(legacyModelPackSet(null, 'medium'), null, 'anthropic/claude-opus-5.5')).toBeUndefined();
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
