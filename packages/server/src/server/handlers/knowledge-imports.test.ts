import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore, knowledgeImporterBindingKey } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { RUN_KNOWLEDGE_IMPORTER_WEBHOOK_ROUTE } from './knowledge-imports';

const binding = { source: 'calendar:primary', scope: 'resource:mastra' } as const;
const context = (mastra: Mastra) => ({
  mastra,
  requestContext: new RequestContext(),
  abortSignal: new AbortController().signal,
});

describe('Knowledge importer webhook handler', () => {
  it('routes authenticated webhook payloads through the keyed Knowledge importer', async () => {
    const handler = vi.fn();
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'knowledge-import-webhook' }),
      structure: {
        scopes: [
          { address: 'org:acme', name: 'Acme' },
          { address: binding.scope, name: 'Mastra', parentAddresses: ['org:acme'] },
        ],
      },
      importers: [
        {
          id: 'calendar',
          access: { 'resource:$resourceId': 'append' },
          triggers: { webhook: { bindings: [binding] } },
          handler,
        },
      ],
    });
    await knowledge.reconcile();
    const mastra = new Mastra({ knowledge: { docs: knowledge } });

    const run = await RUN_KNOWLEDGE_IMPORTER_WEBHOOK_ROUTE.handler({
      ...context(mastra),
      instanceKey: 'docs',
      importerId: 'calendar',
      payload: { eventId: '42', binding: { source: 'forged', scope: 'resource:other' } },
    });

    expect(run).toMatchObject({
      status: 'succeeded',
      triggerKind: 'webhook',
      binding: knowledgeImporterBindingKey(binding),
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ eventId: '42' }),
        run: expect.objectContaining({ binding: knowledgeImporterBindingKey(binding) }),
      }),
    );
    await mastra.shutdown();
  });

  it('does not reveal missing instances, importers, disabled triggers, or undeclared bindings', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'knowledge-import-webhook-hidden' }),
      importers: [{ id: 'private', handler: async () => {} }],
    });
    const mastra = new Mastra({ knowledge: { docs: knowledge } });
    const invoke = (instanceKey: string, importerId: string) =>
      RUN_KNOWLEDGE_IMPORTER_WEBHOOK_ROUTE.handler({
        ...context(mastra),
        instanceKey,
        importerId,
        payload: {},
      });

    await expect(invoke('missing', 'private')).rejects.toMatchObject({ status: 404 });
    await expect(invoke('docs', 'missing')).rejects.toMatchObject({ status: 404 });
    await expect(invoke('docs', 'private')).rejects.toMatchObject({ status: 404 });

    const enabled = new Knowledge({
      storage: new InMemoryStore({ id: 'knowledge-import-webhook-binding-hidden' }),
      importers: [
        {
          id: 'enabled',
          triggers: {
            webhook: {
              bindings: [binding, { source: 'calendar:secondary', scope: binding.scope }],
              resolveBinding: () => ({ source: 'forged', scope: binding.scope }),
            },
          },
          handler: async () => {},
        },
      ],
    });
    const enabledMastra = new Mastra({ knowledge: { docs: enabled } });
    await expect(
      RUN_KNOWLEDGE_IMPORTER_WEBHOOK_ROUTE.handler({
        ...context(enabledMastra),
        instanceKey: 'docs',
        importerId: 'enabled',
        payload: {},
      }),
    ).rejects.toMatchObject({ status: 404 });
    await enabledMastra.shutdown();
    await mastra.shutdown();
  });
});
