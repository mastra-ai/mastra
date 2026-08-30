import { describe, expectTypeOf, it } from 'vitest';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import {
  Knowledge,
  type KnowledgeImporterHandle,
  type StaticKnowledgeImporterOperations,
  type StaticKnowledgeNodeHandle,
} from './index';

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
      access: { 'org:$orgId': 'append' },
      triggers: { webhook: { bindings: [{ source: 'calendar:primary', scope: 'org:acme' }] } },
      handler: async context => {
        expectTypeOf(context.payload).toEqualTypeOf<unknown>();
        const importer = await context.importer();
        expectTypeOf(importer).toEqualTypeOf<StaticKnowledgeImporterOperations>();
        const node = await importer.upsertNode('event:42', { name: 'Planning' });
        expectTypeOf(node).toEqualTypeOf<StaticKnowledgeNodeHandle>();
        await node.appendKnowledge({ text: '10:00–11:00' });
      },
    });

    expectTypeOf(handle).toEqualTypeOf<KnowledgeImporterHandle>();
    expectTypeOf(handle.programmatic).toEqualTypeOf<true>();
    expectTypeOf(handle.webhookPath).toEqualTypeOf<((instanceKey: string) => string) | undefined>();

    const typedHandle = knowledge.registerImporter<{ eventId: string }>({
      id: 'typed-calendar-sync',
      handler: async context => {
        expectTypeOf(context.payload).toEqualTypeOf<{ eventId: string } | undefined>();
      },
    });
    expectTypeOf(typedHandle).toEqualTypeOf<KnowledgeImporterHandle<{ eventId: string }>>();
  });
});
