import { estimateTokenCount } from 'tokenx';
import { describe, expect, it, vi } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import type { KnowledgeStorage } from '../../storage/domains/knowledge';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { OVERFLOW_NAMES, PIN_OVERFLOW_ID } from '../pinned';

const scopes = {
  ...knowledgeMemoryScopes(),
  'role:$orgId:$role': { pinPriority: 5 },
  'policy:$orgId': { access: [{ principal: 'org:$orgId', role: 'viewer' as const }] },
};
const host = { author: 'host' };

async function seed(stored: number, maxPins = 20, maxTokens = 2_000) {
  const store = new InMemoryStore();
  const knowledge = new Knowledge({ storage: store, scopes, tools: true, pinnedContext: { maxPins, maxTokens } });
  const storage = (await store.getStore('knowledge')) as KnowledgeStorage;
  const scope = async (address: string, declaration: string) =>
    (await storage.materializeScope({ address, declaration, name: address, provenance: host })).scope;
  const org = await scope('org:acme', 'org:$orgId');
  await scope('org:globex', 'org:$orgId');
  await scope('role:acme:vip', 'role:$orgId:$role');
  const names: { name: string; vip: boolean }[] = [];
  for (let i = 0; i < stored; i++) {
    const vip = i % 10 === 0;
    const name = `Pin ${String(i).padStart(3, '0')}`;
    const page = await storage.createPage({ parentId: org.id, name, body: `Body of ${name}.`, provenance: host });
    await storage.addPinAudience({
      pageId: page.id,
      audience: [vip ? 'role:acme:vip' : 'org:acme'],
      createdBy: 'host',
    });
    // Pins created in order, so later pins are newer.
    names.push({ name, vip });
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, ['org:acme', 'role:acme:vip']);
  const context = { requestContext, agent: { agentId: 'a', resourceId: 'u-1', threadId: 't-1' } };
  return { knowledge, storage, context, names };
}

const countCalls = (storage: KnowledgeStorage) => {
  const calls: string[] = [];
  for (const method of ['getPage', 'getPages', 'getPageByPath', 'getScopesByAddress', 'listPins'] as const) {
    const original = storage[method].bind(storage) as (...args: unknown[]) => unknown;
    vi.spyOn(storage, method).mockImplementation(((...args: unknown[]) => {
      calls.push(method);
      return original(...args);
    }) as never);
  }
  return calls;
};

describe('Knowledge pin delivery cost', () => {
  it('delivers 200 stored pins with a fixed handful of store calls, in priority then recency order', async () => {
    const { knowledge, storage, context, names } = await seed(200);
    const calls = countCalls(storage);
    const pins = await knowledge.__deliveredPins(context as never);

    // One listing per pinPriority tier the run holds (role, thread, resource, org), one count, one
    // batched page fetch and one batched scope fetch for display labels; never a page read per pin (run start may read scope pages; that is checked
    // below by comparing with a run that has few pins).
    expect(calls.filter(call => call === 'listPins' || call === 'getPages')).toEqual([
      'listPins',
      'listPins',
      'listPins',
      'listPins',
      'listPins',
      'getPages',
      'getPages',
    ]);
    // And the same store calls as a run with a handful of pins.
    const few = await seed(25);
    const fewCalls = countCalls(few.storage);
    await few.knowledge.__deliveredPins(few.context as never);
    expect(calls).toEqual(fewCalls);

    const expected = [...names.filter(n => n.vip).reverse(), ...names.filter(n => !n.vip).reverse()].map(n => n.name);
    const delivered = pins.filter(pin => pin.id !== PIN_OVERFLOW_ID);
    expect(delivered.map(pin => pin.text.split(' (')[0])).toEqual(expected.slice(0, 20));
    // Display fields for UIs; the overflow entry has neither.
    expect(delivered.map(pin => [pin.name, pin.scope])).toEqual(expected.slice(0, 20).map(name => [name, 'org:acme']));

    const overflow = pins.find(pin => pin.id === PIN_OVERFLOW_ID)!;
    expect(overflow).not.toHaveProperty('name');
    expect(overflow).not.toHaveProperty('scope');
    expect(overflow.text).toBe(
      `Also pinned (open with knowledge_read): ${expected.slice(20, 20 + OVERFLOW_NAMES).join(', ')}, …and ${
        200 - 20 - OVERFLOW_NAMES
      } more`,
    );
  });

  it('keeps the overflow line inside the token budget', async () => {
    const { knowledge, context } = await seed(60, 20, 120);
    const pins = await knowledge.__deliveredPins(context as never);
    expect(estimateTokenCount(pins.map(pin => pin.text).join(''))).toBeLessThanOrEqual(120);
    const overflow = pins.find(pin => pin.id === PIN_OVERFLOW_ID)!;
    expect(overflow.text).toMatch(/…and \d+ more$/);
    const listed = overflow.text.replace(/^.*?: /, '').split(', ').length - 1;
    expect(listed).toBeLessThanOrEqual(OVERFLOW_NAMES);
  });

  it('says nothing about overflow when every stored pin fits', async () => {
    const { knowledge, context } = await seed(5);
    const pins = await knowledge.__deliveredPins(context as never);
    expect(pins).toHaveLength(5);
    expect(pins.some(pin => pin.id === PIN_OVERFLOW_ID)).toBe(false);
  });
});
