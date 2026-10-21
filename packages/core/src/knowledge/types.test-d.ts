import { describe, expectTypeOf, it } from 'vitest';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { Knowledge } from './index';

describe('Knowledge public types', () => {
  it('preserves keyed instance types through Mastra accessors', () => {
    const primary = new Knowledge({ id: 'primary', storage: new InMemoryStore() });
    const analytics = new Knowledge({ id: 'analytics', storage: new InMemoryStore() });
    const mastra = new Mastra({ knowledge: { default: primary, analytics } });

    expectTypeOf(mastra.getKnowledge('default')).toEqualTypeOf<Knowledge>();
    expectTypeOf(mastra.getKnowledge('analytics')).toEqualTypeOf<Knowledge>();
    expectTypeOf(mastra.listKnowledge()).toEqualTypeOf<{
      default: Knowledge;
      analytics: Knowledge;
    }>();
  });
});
