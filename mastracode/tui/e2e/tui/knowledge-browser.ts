import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const PRIMARY_TITLE = 'Knowledge E2E Primary';
const SECONDARY_TITLE = 'Knowledge E2E Secondary';

export const knowledgeBrowserScenario: McE2eScenario = {
  name: 'knowledge-browser',
  projectFixture: 'long-branch',
  description: 'Seed scoped knowledge and traverse scopes, nodes, relations, content, activity, and a thread switch.',
  testName: 'browses scoped Subconscious knowledge through the real TUI',
  disableMemory: false,
  env: () => ({ MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS: '1' }),
  async inProcessApp({ startMastraCodeApp }) {
    const app = await startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
      },
      async onCreated(result) {
        const ownerId = result.session.identity.getOwnerId();
        const resourceId = result.session.identity.getResourceId();
        const primary = await result.session.thread.create({ title: PRIMARY_TITLE });
        const secondary = await result.session.thread.create({ title: SECONDARY_TITLE });
        await result.session.thread.switch({ threadId: primary.id });

        const knowledge = result.storage.stores?.knowledge;
        if (!knowledge) throw new Error('Knowledge storage unavailable in knowledge-browser E2E scenario.');

        const orgAddress = `org:${ownerId}`;
        const resourceAddress = `resource:${resourceId}`;
        const primaryAddress = `${resourceAddress}:thread:${primary.id}`;
        const secondaryAddress = `${resourceAddress}:thread:${secondary.id}`;
        const foreignAddress = 'resource:foreign-project';
        const reconciliation = await knowledge.reconcileStructure({
          scopes: [
            { address: orgAddress, name: 'organization' },
            { address: resourceAddress, name: resourceId, parentAddresses: [orgAddress] },
            { address: primaryAddress, name: PRIMARY_TITLE, parentAddresses: [resourceAddress] },
            { address: secondaryAddress, name: SECONDARY_TITLE, parentAddresses: [resourceAddress] },
            { address: foreignAddress, name: 'foreign-project', parentAddresses: [orgAddress] },
          ],
        });
        const orgScopeIds = [reconciliation.scopes[orgAddress]!];
        const resourceScopeIds = [reconciliation.scopes[resourceAddress]!];
        const primaryScopeIds = [reconciliation.scopes[primaryAddress]!];
        const secondaryScopeIds = [reconciliation.scopes[secondaryAddress]!];
        const foreignScopeIds = [reconciliation.scopes[foreignAddress]!];

        await knowledge.createNode({ name: 'Organization policy', kind: 'policy', scopeIds: orgScopeIds });
        const beta = await knowledge.createNode({ name: 'Beta service', kind: 'service', scopeIds: resourceScopeIds });
        const atlas = await knowledge.createNode({ name: 'Atlas launch', kind: 'project', scopeIds: resourceScopeIds });
        await knowledge.createNode({ name: 'Primary thread note', kind: 'note', scopeIds: primaryScopeIds });
        await knowledge.createNode({ name: 'Secondary thread note', kind: 'note', scopeIds: secondaryScopeIds });
        await knowledge.createNode({ name: 'Foreign project secret', kind: 'secret', scopeIds: foreignScopeIds });
        await knowledge.createRecord({
          id: '01KXKNOWLEDGEFACT0000000001',
          node: atlas,
          text: 'Atlas launch depends on [[Beta service]].',
          scopeIds: resourceScopeIds,
          source: primary.id,
          metadata: { sourceThreadId: primary.id },
          resolutionScopeIds: resourceScopeIds,
        });
        for (let index = 0; index < 25; index++) {
          await knowledge.createRecord({
            id: `01KXKNOWLEDGEFILLER${String(index).padStart(8, '0')}`,
            node: atlas,
            text: `Atlas launch checkpoint ${index + 1} is complete.`,
            scopeIds: resourceScopeIds,
            source: primary.id,
            metadata: { sourceThreadId: primary.id },
            resolutionScopeIds: resourceScopeIds,
          });
        }
        await knowledge.createRecord({
          id: '01KXKNOWLEDGEFACT0000000002',
          node: beta,
          text: 'Beta service health checks are green.',
          scopeIds: resourceScopeIds,
          source: primary.id,
          metadata: { sourceThreadId: primary.id },
          resolutionScopeIds: resourceScopeIds,
        });
        const brief = await knowledge.createNode({
          name: 'Atlas launch brief',
          kind: 'document',
          scopeIds: resourceScopeIds,
        });
        await knowledge.createRecord({
          node: brief,
          text: 'The launch uses [[Atlas launch]] and [[Beta service]]. [[No such node 9fca]] remains unresolved.',
          scopeIds: resourceScopeIds,
          source: primary.id,
          metadata: { sourceThreadId: primary.id },
          resolutionScopeIds: resourceScopeIds,
        });
      },
    });
    return { stop: () => app.stop?.() };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/knowledge');
    await runtime.waitForScreenText(/\[scopes\].*nodes.*activity/i, terminal);
    await runtime.waitForScreenText(/resource\s+project-/i, terminal);
    runtime.printScreen('knowledge scope roots', terminal);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/\[nodes\]/i, terminal);
    await runtime.waitForScreenText(/Sort: Relevant.*recent window/i, terminal);
    await runtime.waitForScreenText(/Sources/i, terminal);
    await runtime.waitForScreenText(/Referenced only/i, terminal);
    await runtime.waitForScreenText(/Isolated/i, terminal);
    runtime.printScreen('knowledge node graph roles', terminal);
    terminal.write('\x13');
    await runtime.waitForScreenText(/Sort: Recent/i, terminal);
    terminal.write('\x13');
    await runtime.waitForScreenText(/Sort: Connected.*recent window/i, terminal);
    terminal.write('Atlas launch');
    await runtime.waitForScreenText(/Atlas launch.*→1 ←1.*exact:resource/i, terminal);
    await runtime.waitForScreenTextAbsent(/Foreign project secret/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Atlas launch checkpoint/i, terminal);
    await runtime.waitForScreenText(/Bridge · 27 records · 1 outgoing · 1 incoming/i, terminal);
    await runtime.waitForScreenText(/Load more knowledge/i, terminal);
    await runtime.waitForScreenText(/Outgoing links \(partial\)/i, terminal);
    terminal.write('\x1b[H');
    for (let index = 0; index < 25; index++) terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/The launch uses \[\[Atlas launch\]\]/i, terminal);
    await runtime.waitForScreenText(/→ Beta service/i, terminal);
    await runtime.waitForScreenTextAbsent(/Outgoing links \(partial\)/i, terminal);
    await runtime.waitForScreenText(/Source · 1 records · 3 outgoing · 0 incoming/i, terminal);
    runtime.printScreen('knowledge content and directional relations', terminal);

    terminal.write('\t');
    await runtime.waitForScreenText(/\[activity\]/i, terminal);
    await runtime.waitForScreenText(/create: Atlas launch/i, terminal);
    runtime.printScreen('knowledge activity', terminal);

    terminal.write('\x1b');
    terminal.submit('/threads');
    await runtime.waitForScreenText(new RegExp(SECONDARY_TITLE, 'i'), terminal);
    terminal.write('Knowledge E2E Secondary');
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to: Knowledge E2E Secondary/i, terminal);

    terminal.submit('/knowledge');
    await runtime.waitForScreenText(/\[scopes\]/i, terminal);
    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/\[nodes\]/i, terminal);
    terminal.write('Secondary thread note');
    await runtime.waitForScreenText(/Secondary thread note.*exact:thread/i, terminal);
    await runtime.waitForScreenTextAbsent(/Primary thread note/i, terminal);
    runtime.printScreen('knowledge thread refresh', terminal);

    expect(terminal.serialize().view).not.toContain('Foreign project secret');
    terminal.write('\x1b');
  },
};
