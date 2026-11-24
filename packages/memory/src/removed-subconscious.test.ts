import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { KnowledgeSemanticIndexCoordinator, Memory, StaleKnowledgeSemanticIndexError, Subconscious } from './index';

describe('removed Subconscious options and exports', () => {
  it('refuses the old Memory knowledge option and points to the agent', () => {
    expect(() => new Memory({ storage: new InMemoryStore(), knowledge: 'team' })).toThrow(
      'attach Knowledge to the agent instead',
    );
    expect(() => new Memory({ storage: new InMemoryStore(), knowledge: false })).not.toThrow();
  });

  it('refuses observationalMemory.experimental_subconscious', () => {
    expect(
      () =>
        new Memory({
          storage: new InMemoryStore(),
          options: { observationalMemory: { experimental_subconscious: {} } },
        }),
    ).toThrow('Subconscious was removed');
  });

  it('keeps the old exports loadable, throwing only when constructed', () => {
    expect(() => new Subconscious({})).toThrow('Subconscious was removed');
    expect(() => new KnowledgeSemanticIndexCoordinator({})).toThrow('moved into Knowledge');
    expect(new StaleKnowledgeSemanticIndexError('stale')).toBeInstanceOf(Error);
  });
});
