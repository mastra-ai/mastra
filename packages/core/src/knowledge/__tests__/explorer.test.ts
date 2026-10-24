import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../storage';
import {
  knowledgeViewScope,
  readKnowledgeActivity,
  readKnowledgeGraph,
  readKnowledgeNode,
  searchKnowledgeNodes,
} from '../explorer';
import { Knowledge } from '../index';
import { createPinnedTools } from '../pinned';

async function seed() {
  const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'explorer' }), pins: true });
  const store = await knowledge.getStorage();
  const org = ['org:self'];
  const team = ['org:self', 'team:self:x'];
  const payments = await store.createNode({ name: 'Payments', kind: 'service', scope: org });
  const runbook = await store.createNode({ name: 'Runbook', kind: 'doc', scope: org });
  const secret = await store.createNode({ name: 'Secret', kind: 'doc', scope: team });
  await store.appendKnowledge({
    node: payments.id,
    text: 'Payments follows the [[Runbook]].',
    scope: org,
    sourceThreadId: 't1',
    resolutionScope: org,
    defaultScope: org,
  });
  await store.appendKnowledge({
    node: secret.id,
    text: 'Team-only note.',
    scope: team,
    sourceThreadId: 't2',
    resolutionScope: team,
    defaultScope: team,
  });
  const pinTools = createPinnedTools(
    { getKnowledgeStore: () => knowledge.getStorage() },
    { scope: org, sourceThreadId: 't1', maxPins: 20, maxTokens: 500 },
  ) as Record<string, { execute: (input: unknown) => Promise<unknown> }>;
  await pinTools.knowledge_pin!.execute({ text: 'Always read [[Payments]] first.' });
  return { store, org, team, payments, runbook, secret };
}

describe('Knowledge explorer reads', () => {
  it('shows only what the view holds, with edges and pins marked, and never the reserved pinned node', async () => {
    const { store, org, payments, runbook } = await seed();
    const graph = await readKnowledgeGraph(store, knowledgeViewScope(org));

    expect(graph.nodes.map(node => node.name).sort()).toEqual(['Payments', 'Runbook']);
    expect(graph.nodes.some(node => node.name === 'pinned')).toBe(false);
    expect(graph.edges).toEqual([
      expect.objectContaining({ source: payments.id, target: runbook.id, type: 'wikilink' }),
    ]);
    expect(graph.nodes.find(node => node.id === payments.id)?.pinned).toBe(true);
    expect(graph.nodes.find(node => node.id === runbook.id)?.pinned).toBe(false);
    expect(graph.pinCount).toBe(1);
    expect(graph.records.some(record => record.pinned)).toBe(true);
  });

  it('widens with the view: a team view also shows the team node', async () => {
    const { store, team } = await seed();
    const graph = await readKnowledgeGraph(store, knowledgeViewScope(team));
    expect(graph.nodes.map(node => node.name).sort()).toEqual(['Payments', 'Runbook', 'Secret']);
  });

  it('refuses a node the view cannot see', async () => {
    const { store, org, team, secret } = await seed();
    expect(await readKnowledgeNode(store, org, secret.id)).toBeNull();
    const visible = await readKnowledgeNode(store, team, secret.id);
    expect(visible?.records.map(record => record.text)).toEqual(['Team-only note.']);
  });

  it('marks pinned records and splits owned from mentioning', async () => {
    const { store, org, payments, runbook } = await seed();
    const detail = await readKnowledgeNode(store, org, payments.id);
    expect(detail?.records.map(record => [record.relation, record.pinned])).toEqual(
      expect.arrayContaining([['owned', false]]),
    );
    const runbookDetail = await readKnowledgeNode(store, org, runbook.id);
    expect(runbookDetail?.records.map(record => record.relation)).toEqual(['mentions']);
  });

  it('searches and lists activity inside the view only', async () => {
    const { store, org } = await seed();
    const found = await searchKnowledgeNodes(store, org, 'Payments');
    expect(found.results.map(result => result.name)).toContain('Payments');
    expect(found.results.map(result => result.name)).not.toContain('Secret');

    const activity = await readKnowledgeActivity(store, org);
    expect(activity.events.length).toBeGreaterThan(0);
    expect(activity.events.every(event => event.scope.every(tag => org.includes(tag)))).toBe(true);
  });

  it('rejects an invalid view', () => {
    expect(() => knowledgeViewScope([])).toThrow();
    expect(() => knowledgeViewScope(Array.from({ length: 9 }, (_, i) => `t${i}:x`))).toThrow();
  });
});
