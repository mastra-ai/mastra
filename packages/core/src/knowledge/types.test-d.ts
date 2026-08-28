import { describe, expectTypeOf, it } from 'vitest';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { Knowledge, type KnowledgeImporterHandle } from './index';

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

  it('types importer registration handles', () => {
    const knowledge = new Knowledge();
    const handle = knowledge.registerImporter({
      id: 'calendar-sync',
      source: { type: 'calendar', id: 'primary' },
      kind: 'static',
      scope: ['org:acme'],
      role: 'append',
      triggers: { webhook: true },
    });

    expectTypeOf(handle).toEqualTypeOf<KnowledgeImporterHandle>();
    expectTypeOf(handle.programmatic).toEqualTypeOf<true>();
    expectTypeOf(handle.webhookPath).toEqualTypeOf<((instanceKey: string) => string) | undefined>();
  });
});
