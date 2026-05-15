import { describe, expect, it } from 'vitest';

import { Memory, ObservationalMemory, Subconscious } from './index';

describe('ObservationalMemory wrapper', () => {
  it('enables observational memory with top-level psyche config', () => {
    const subconscious = new Subconscious({ model: 'default' as any });
    const memory = new ObservationalMemory({
      subconscious,
      observation: { psyches: ['critic', 'learner'] },
    });

    expect((memory as any).threadConfig.observationalMemory).toMatchObject({
      subconscious,
      observation: { psyches: ['critic', 'learner'] },
    });
  });

  it('preserves unrelated options like working memory', () => {
    const memory = new ObservationalMemory({
      observation: { psyches: ['critic'] },
      options: { workingMemory: { enabled: true, template: 'profile' } },
    });

    expect((memory as any).threadConfig.workingMemory).toMatchObject({ enabled: true, template: 'profile' });
    expect((memory as any).threadConfig.observationalMemory).toMatchObject({
      observation: { psyches: ['critic'] },
    });
  });

  it('keeps existing Memory observationalMemory behavior unchanged', () => {
    const memory = new Memory({ options: { observationalMemory: { model: 'default' as any } } });

    expect((memory as any).threadConfig.observationalMemory).toMatchObject({ model: 'default' });
  });
});
