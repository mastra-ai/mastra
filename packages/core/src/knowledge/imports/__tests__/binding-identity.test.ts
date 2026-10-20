import { describe, expect, it } from 'vitest';
import { RequestContext } from '../../../request-context';
import { InMemoryStore, knowledgeImporterBindingKey } from '../../../storage';
import { Knowledge } from '../../index';

/**
 * Q4 invariant: an import run's identity comes from the import binding and its
 * registration — never from the operator or session that happened to trigger
 * the run. Writes land under the binding's scope (inside the registration's
 * org), and operator-controlled input cannot divert a run into another org.
 */

const destBinding = { source: 'calendar:primary', scope: 'project:dest' } as const;
const structure = {
  scopes: [
    { address: 'org:binding-org', name: 'Binding Org' },
    { address: 'project:dest', name: 'Destination', parentAddresses: ['org:binding-org'] },
    { address: 'org:operator-org', name: 'Operator Org' },
    { address: 'project:operator-home', name: 'Operator Home', parentAddresses: ['org:operator-org'] },
  ],
};

function createKnowledge(options: { resolveBindingFromContext?: boolean } = {}) {
  return new Knowledge({
    storage: new InMemoryStore({ id: 'import-binding-identity' }),
    structure,
    importers: [
      {
        id: 'calendar',
        // The registration may write only inside its own org's destination.
        access: { 'project:dest': 'edit' },
        triggers: {
          webhook: {
            bindings: [destBinding],
            ...(options.resolveBindingFromContext
              ? {
                  // A resolver that trusts operator-controlled request context —
                  // the runner must still confine it to declared bindings.
                  resolveBinding: ({ requestContext }) => ({
                    source: destBinding.source,
                    scope: (requestContext.get('operatorTargetScope') as string) ?? destBinding.scope,
                  }),
                }
              : {}),
          },
        },
        handler: async ctx => {
          const importer = await ctx.importer();
          const node = await importer.upsertNode('event-1', {
            scopes: [importer.scope],
            name: 'Imported Event',
            metadata: { kind: 'event' },
          });
          await node.appendKnowledge({ text: 'imported evidence' });
        },
      },
    ],
  });
}

describe('Knowledge import run identity comes from the binding, not the operator', () => {
  it('lands writes under the binding scope inside the registration org, with nothing in the operator org', async () => {
    const knowledge = createKnowledge();
    await knowledge.reconcile();

    const run = await knowledge.getImporter('calendar')!.run(destBinding);
    expect(run.status).toBe('succeeded');
    // The run's identity is the binding itself.
    expect(run.binding).toBe(knowledgeImporterBindingKey(destBinding));

    const storage = await knowledge.getStorage();
    const dest = await storage.getScopeAddress('project:dest');
    const operatorHome = await storage.getScopeAddress('project:operator-home');
    const operatorOrg = await storage.getScopeAddress('org:operator-org');
    expect(dest && operatorHome && operatorOrg).toBeTruthy();

    // The written node is scoped exactly to the binding's destination scope.
    const written = await knowledge.listNodes({ scopeIds: [dest!.scopeNodeId], isScope: false });
    expect(written.map(node => node.name)).toEqual(['Imported Event']);
    expect(await storage.getNodeScopeIds(written[0]!.id)).toEqual([dest!.scopeNodeId]);

    // The appended record carries the binding's scope too, not just its node.
    const { records } = await storage.listRecordsBySource({
      source: destBinding.source,
      scopeIds: [dest!.scopeNodeId],
      limit: 10,
    });
    expect(records.map(record => record.text)).toEqual(['imported evidence']);
    expect(await storage.getRecordScopeIds(records[0]!.id)).toEqual([dest!.scopeNodeId]);

    // Import activity is attributed to the binding scope (contextScopeId) on
    // BOTH write paths: the node upsert and the record append.
    const activity = await storage.listActivity({ scopeIds: [dest!.scopeNodeId], limit: 50 });
    const runEvents = activity.filter(event => event.importRunId === run.id);
    expect(runEvents.map(event => event.targetId)).toEqual(expect.arrayContaining([written[0]!.id, records[0]!.id]));
    for (const event of runEvents) {
      expect(event.contextScopeId).toBe(dest!.scopeNodeId);
    }

    // Nothing imported is visible from the operator's org or project.
    for (const foreign of [operatorOrg!, operatorHome!]) {
      const leaked = await knowledge.listNodes({ scopeIds: [foreign.scopeNodeId], isScope: false });
      expect(leaked).toEqual([]);
      const leakedRecords = await storage.listRecordsBySource({
        source: destBinding.source,
        scopeIds: [foreign.scopeNodeId],
        limit: 10,
      });
      expect(leakedRecords.records).toEqual([]);
      const foreignActivity = await storage.listActivity({ scopeIds: [foreign.scopeNodeId], limit: 50 });
      expect(foreignActivity.filter(event => event.importRunId === run.id)).toEqual([]);
    }
  });

  it('rejects an operator-steered webhook resolver that targets another org, creating no run', async () => {
    const knowledge = createKnowledge({ resolveBindingFromContext: true });
    await knowledge.reconcile();

    const importer = knowledge.getImporter('calendar')!;
    const operatorContext: RequestContext = new RequestContext();
    operatorContext.set('operatorTargetScope', 'project:operator-home');
    const diverted = await importer.triggers.webhook!.resolveBinding!({
      payload: {},
      requestContext: operatorContext,
    });
    // The operator-controlled resolver did ask for the foreign scope…
    expect(diverted.scope).toBe('project:operator-home');
    // …but the runner refuses any webhook binding the registration did not
    // declare — whether the operator diverts the scope or the source.
    const undeclared = [diverted, { source: 'operator:feed', scope: destBinding.scope }];
    for (const binding of undeclared) {
      await expect(knowledge.runImporter('calendar', binding, {}, { triggerKind: 'webhook' })).rejects.toThrow(
        'does not allow this webhook binding',
      );
    }

    expect((await knowledge.listImportRuns({ importerId: 'calendar' })).runs).toEqual([]);
    const storage = await knowledge.getStorage();
    const operatorHome = await storage.getScopeAddress('project:operator-home');
    expect(await knowledge.listNodes({ scopeIds: [operatorHome!.scopeNodeId], isScope: false })).toEqual([]);
  });

  it("fails a programmatic run against a scope outside the registration's access without writing", async () => {
    const knowledge = createKnowledge();
    await knowledge.reconcile();

    const run = await knowledge
      .getImporter('calendar')!
      .run({ source: destBinding.source, scope: 'project:operator-home' });
    expect(run.status).toBe('failed');
    expect(run.error).toContain('cannot write to scope');

    const storage = await knowledge.getStorage();
    const operatorHome = await storage.getScopeAddress('project:operator-home');
    expect(await knowledge.listNodes({ scopeIds: [operatorHome!.scopeNodeId], isScope: false })).toEqual([]);
  });
});
