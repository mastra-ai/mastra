import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const PRIMARY_TITLE = 'Knowledge E2E Primary';
const SECONDARY_TITLE = 'Knowledge E2E Secondary';

export const knowledgeBrowserScenario: McE2eScenario = {
  name: 'knowledge-browser',
  projectFixture: 'long-branch',
  description: 'Seed scoped knowledge and traverse scopes, entities, relations, pages, activity, and a thread switch.',
  testName: 'browses scoped Subconscious knowledge through the real TUI',
  disableMemory: false,
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

        const orgScope = [`org:${ownerId}`];
        const resourceScope = [...orgScope, `resource:${resourceId}`];
        const primaryScope = [...resourceScope, `thread:${primary.id}`];
        const secondaryScope = [...resourceScope, `thread:${secondary.id}`];
        const foreignScope = [...orgScope, 'resource:foreign-project'];

        await knowledge.createEntity({
          id: 'kb-org-policy',
          name: 'Organization policy',
          kind: 'policy',
          scope: orgScope,
        });
        const beta = await knowledge.createEntity({
          id: 'kb-beta',
          name: 'Beta service',
          kind: 'service',
          scope: resourceScope,
        });
        const atlas = await knowledge.createEntity({
          id: 'kb-atlas',
          name: 'Atlas launch',
          kind: 'project',
          scope: resourceScope,
        });
        await knowledge.createEntity({
          id: 'kb-primary-note',
          name: 'Primary thread note',
          kind: 'note',
          scope: primaryScope,
        });
        await knowledge.createEntity({
          id: 'kb-secondary-note',
          name: 'Secondary thread note',
          kind: 'note',
          scope: secondaryScope,
        });
        await knowledge.createEntity({
          id: 'kb-foreign-secret',
          name: 'Foreign project secret',
          kind: 'secret',
          scope: foreignScope,
        });
        await knowledge.appendFact({
          id: '01KXKNOWLEDGEFACT0000000001',
          parentEntityId: atlas.id,
          text: 'Atlas launch depends on [[Beta service]].',
          scope: resourceScope,
          sourceThreadId: primary.id,
          resolutionScope: resourceScope,
          defaultScope: resourceScope,
        });
        await knowledge.appendFact({
          id: '01KXKNOWLEDGEFACT0000000002',
          parentEntityId: beta.id,
          text: 'Beta service health checks are green.',
          scope: resourceScope,
          sourceThreadId: primary.id,
          resolutionScope: resourceScope,
          defaultScope: resourceScope,
        });
        await knowledge.createPage({
          id: 'kb-launch-page',
          name: 'Atlas launch brief',
          body: 'The launch uses [[Atlas launch]] and [[Beta service]]. [[No such entity 9fca]] remains unresolved.',
          scope: resourceScope,
        });
      },
    });
    return { stop: () => app.stop?.() };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/knowledge');
    await runtime.waitForScreenText(/\[scopes\].*entities.*pages.*activity/i, terminal);
    await runtime.waitForScreenText(/resource\s+project-/i, terminal);
    runtime.printScreen('knowledge scope roots', terminal);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/\[entities\]/i, terminal);
    terminal.write('Atlas launch');
    await runtime.waitForScreenText(/Atlas launch.*exact:resource/i, terminal);
    await runtime.waitForScreenTextAbsent(/Foreign project secret/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Atlas launch depends on.*Beta service/i, terminal);
    await runtime.waitForScreenText(/Related entities/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Beta service health checks are green/i, terminal);
    runtime.printScreen('knowledge relation traversal', terminal);

    terminal.write('\x7f');
    terminal.write('\t');
    await runtime.waitForScreenText(/\[pages\]/i, terminal);
    await runtime.waitForScreenText(/Atlas launch brief/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Atlas launch → Atlas launch/i, terminal);
    await runtime.waitForScreenText(/No such entity 9fca → No such entity 9fca/i, terminal);
    runtime.printScreen('knowledge page detail', terminal);

    terminal.write('\x7f');
    terminal.write('\t');
    await runtime.waitForScreenText(/\[activity\]/i, terminal);
    await runtime.waitForScreenText(/entity-created:|fact-created:/i, terminal);
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
    await runtime.waitForScreenText(/\[entities\]/i, terminal);
    terminal.write('Secondary thread note');
    await runtime.waitForScreenText(/Secondary thread note.*exact:thread/i, terminal);
    await runtime.waitForScreenTextAbsent(/Primary thread note/i, terminal);
    runtime.printScreen('knowledge thread refresh', terminal);

    expect(terminal.serialize().view).not.toContain('Foreign project secret');
    terminal.write('\x1b');
  },
};
