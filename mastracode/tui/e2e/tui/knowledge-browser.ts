import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { LOCAL_KNOWLEDGE_ORG_ID } from '@mastra/code-sdk';
import { expect } from './expect.js';

import type { McE2eScenario } from './types.js';

const PRIMARY_TITLE = 'Knowledge E2E Primary';
const SECONDARY_TITLE = 'Knowledge E2E Secondary';

export const knowledgeBrowserScenario: McE2eScenario = {
  name: 'knowledge-browser',
  projectFixture: 'long-branch',
  description: 'Seed scoped knowledge and traverse scopes, nodes, relations, content, activity, and a thread switch.',
  testName: 'browses scoped knowledge through the real TUI',
  disableMemory: false,
  prepare({ appDataDir }) {
    // Knowledge is the /settings toggle, read at startup.
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    settings.signals = { ...settings.signals, experimentalKnowledge: true };
    writeFileSync(settingsPath, JSON.stringify(settings));
  },
  async inProcessApp({ startMastraCodeApp }) {
    const app = await startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
      },
      async onCreated(result) {
        const resourceId = result.session.identity.getResourceId();
        const primary = await result.session.thread.create({ title: PRIMARY_TITLE });
        const secondary = await result.session.thread.create({ title: SECONDARY_TITLE });
        await result.session.thread.switch({ threadId: primary.id });

        const knowledge = await result.storage.getStore('knowledge');
        if (!knowledge) throw new Error('Knowledge storage unavailable in knowledge-browser E2E scenario.');

        // Seed pages straight into the page store under the scopes the built-in Knowledge declares.
        const provenance = { author: 'host' };
        const scopes = new Map<string, string>();
        const scope = async (address: string, declaration: string, parent?: string) => {
          const known = scopes.get(address);
          if (known) return known;
          const { scope: page } = await knowledge.materializeScope({
            address,
            declaration,
            name: address,
            parentId: parent ? (scopes.get(parent) ?? null) : null,
            provenance,
          });
          scopes.set(address, page.id);
          return page.id;
        };
        const org = `org:${LOCAL_KNOWLEDGE_ORG_ID}`;
        const resource = `resource:${resourceId}`;
        await scope(org, 'org:$orgId');
        await scope(resource, 'resource:$resourceId', org);
        await scope('resource:foreign-project', 'resource:$resourceId', org);
        await scope(`thread:${primary.id}`, 'thread:$threadId', resource);
        await scope(`thread:${secondary.id}`, 'thread:$threadId', resource);
        const page = async (address: string, name: string, body?: string) =>
          knowledge.createPage({ parentId: scopes.get(address)!, name, body, provenance });
        const note = async (pageId: string, scopeId: string, text: string, mentions: string[] = []) =>
          knowledge.addNote({
            pageId,
            text,
            stampScopeIds: [scopeId],
            mentions,
            provenance: { author: 'agent:code', sourceThreadId: primary.id },
          });

        await page(org, 'Organization policy');
        const beta = await page(resource, 'Beta service');
        const atlas = await page(resource, 'Atlas launch');
        await page(`thread:${primary.id}`, 'Primary thread note');
        await page(`thread:${secondary.id}`, 'Secondary thread note');
        await page('resource:foreign-project', 'Foreign project secret');
        await note(atlas.id, atlas.scopeId, 'Atlas launch depends on [[Beta service]].', [beta.id]);
        for (let index = 0; index < 25; index++) {
          await note(atlas.id, atlas.scopeId, `Atlas launch checkpoint ${index + 1} is complete.`);
        }
        await note(beta.id, beta.scopeId, 'Beta service health checks are green.');
        await page(
          resource,
          'Atlas launch brief',
          'The launch uses [[Atlas launch]] and [[Beta service]]. [[No such node 9fca]] remains unresolved.',
        );
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
    await runtime.waitForScreenText(/Sort: Name/i, terminal);
    await runtime.waitForScreenText(/Sources/i, terminal);
    await runtime.waitForScreenText(/Referenced only/i, terminal);
    await runtime.waitForScreenText(/Isolated/i, terminal);
    runtime.printScreen('knowledge node graph roles', terminal);
    terminal.write('\x13');
    await runtime.waitForScreenText(/Sort: Connected.*first 50 by name/i, terminal);
    terminal.write('\x13');
    await runtime.waitForScreenText(/Sort: Name/i, terminal);
    terminal.write('Atlas launch');
    await runtime.waitForScreenText(/Atlas launch.*→1 ←0.*exact:resource/i, terminal);
    await runtime.waitForScreenTextAbsent(/Foreign project secret/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Atlas launch checkpoint/i, terminal);
    await runtime.waitForScreenText(/Source · 26 records · 1 outgoing · 0 incoming/i, terminal);
    await runtime.waitForScreenText(/Load more knowledge/i, terminal);
    await runtime.waitForScreenText(/Outgoing links \(partial\)/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/→ Beta service/i, terminal);
    await runtime.waitForScreenTextAbsent(/Outgoing links \(partial\)/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Beta service health checks are green/i, terminal);
    await runtime.waitForScreenText(/Referenced by/i, terminal);
    await runtime.waitForScreenText(/← Atlas launch/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Nodes.*Atlas launch.*Beta service.*Atlas launch/i, terminal);
    runtime.printScreen('knowledge directional relation traversal', terminal);

    terminal.write('\x7f');
    terminal.write('\x7f');
    terminal.write('\x7f');
    await runtime.waitForScreenText(/Atlas launch brief/i, terminal);
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Content/i, terminal);
    await runtime.waitForScreenText(/The launch uses \[\[Atlas launch\]\]/i, terminal);
    await runtime.waitForScreenText(/→ Atlas launch/i, terminal);
    runtime.printScreen('knowledge content node detail', terminal);

    terminal.write('\x7f');
    terminal.write('\t');
    await runtime.waitForScreenText(/\[activity\]/i, terminal);
    await runtime.waitForScreenText(/page-created:|note-added:/i, terminal);
    runtime.printScreen('knowledge activity', terminal);

    terminal.write('\x1b');
    terminal.submit('/threads');
    await runtime.waitForScreenText(new RegExp(SECONDARY_TITLE, 'i'), terminal);
    terminal.write('Knowledge E2E Secondary');
    terminal.write('\r');

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
