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

    // The webhook acknowledges acceptance with the queued run; the drain
    // completes it asynchronously so long agentic runs cannot outlive the
    // request's gateway timeout.
    expect(run).toMatchObject({
      triggerKind: 'webhook',
      binding: knowledgeImporterBindingKey(binding),
    });
    expect(['queued', 'running']).toContain(run.status);
    let terminal = await knowledge.getImportRun(run.id);
    while (terminal && !['succeeded', 'failed', 'skipped', 'interrupted'].includes(terminal.status)) {
      await new Promise(resolve => setTimeout(resolve, 25));
      terminal = await knowledge.getImportRun(run.id);
    }
    expect(terminal).toMatchObject({ status: 'succeeded' });
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
