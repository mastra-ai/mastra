import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../storage';
import { Knowledge } from '../index';
import { createPinnedTools, listPinnedKnowledge } from '../pinned';

async function setup() {
  const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'pins-scopes' }), pins: true });
  const store = await knowledge.getStorage();
  const host = { getKnowledgeStore: () => knowledge.getStorage() };
  const tools = (scope: string[], readOnly: string[] = []) =>
    createPinnedTools(host, { scope, readOnly, sourceThreadId: 't', maxPins: 20, maxTokens: 500 }) as Record<
      string,
      { execute: (input: unknown, context?: unknown) => Promise<any> }
    >;
  return { store, tools };
}

const director = ['org:self', 'team:self:director'];
const member = ['agent:alex', 'org:self', 'team:self:x'];

describe('pins across scopes', () => {
  it("shows a member the director's org pins next to its own, without fragmenting either set", async () => {
    const { store, tools } = await setup();
    await tools(director).knowledge_pin!.execute({ text: 'Org: ship on Fridays only.', scope: ['org:self'] });
    await tools(member, ['org:self']).knowledge_pin!.execute({ text: 'Alex: prefers short answers.' });
    await tools(member, ['org:self']).knowledge_pin!.execute({ text: 'Alex: uses metric units.' });

    const memberSet = await listPinnedKnowledge({ store, scope: member });
    expect(memberSet.pins.map(pin => pin.text).sort()).toEqual([
      'Alex: prefers short answers.',
      'Alex: uses metric units.',
      'Org: ship on Fridays only.',
    ]);
    // One node per pin scope: the org's and the member's.
    expect(memberSet.nodeIds).toHaveLength(2);

    const directorSet = await listPinnedKnowledge({ store, scope: director });
    expect(directorSet.pins.map(pin => pin.text)).toEqual(['Org: ship on Fridays only.']);

    const other = await listPinnedKnowledge({ store, scope: ['org:self', 'team:self:y'] });
    expect(other.pins.map(pin => pin.text)).toEqual(['Org: ship on Fridays only.']);
  });

  it("lets a member see but not unpin the director's org pin", async () => {
    const { store, tools } = await setup();
    const pin = await tools(director).knowledge_pin!.execute({ text: 'Org rule.', scope: ['org:self'] });
    const recordId = pin.id ?? pin.record?.id ?? (await listPinnedKnowledge({ store, scope: director })).pins[0]!.id;
    const refused = await tools(member, ['org:self'])
      .knowledge_unpin!.execute({ recordId })
      .catch(error => error);
    expect(String(refused?.message ?? refused)).toContain('"org:self" is read-only for this run.');
    expect((await listPinnedKnowledge({ store, scope: member })).pins).toHaveLength(1);
  });
});
