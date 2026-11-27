import { describe, expect, it } from 'vitest';

import { legacyModelPackSet, parseStoredModelSelection } from './model-packs.js';

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
