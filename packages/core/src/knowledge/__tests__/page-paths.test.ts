import { describe, expect, it, vi } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { ConsoleLogger } from '../../logger';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

const memory = knowledgeMemoryScopes();

function setup() {
  const knowledge = new Knowledge({
    storage: new InMemoryStore(),
    tools: true,
    pinnedContext: true,
    scopes: {
      ...memory,
      'org:$orgId': {
        ...memory['org:$orgId'],
        pages: [
          { key: 'policies', name: 'Policies', pages: [{ key: 'refund', name: 'Refund policy' }] },
          { key: 'handbook', name: 'Handbook', pages: [{ key: 'refund', name: 'Refund section' }] },
        ],
        pins: ['org:$orgId#policies/refund'],
      },
    },
  });
  const tools = knowledge.createTools();
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, ['org:acme']);
  const context = { requestContext, agent: { agentId: 'a', resourceId: 'u-1', threadId: 't-1' } };
  const call = (tool: string, input: Record<string, unknown>) =>
    tools[tool]!.execute!(input as never, context as never) as Promise<any>;
  const delivered = async () => (await knowledge.__deliveredPins(context as never)).map(pin => pin.text);
  return { knowledge, call, delivered };
}

describe('Knowledge page key paths', () => {
  it('resolves nested key paths in tool refs, with sibling pages sharing a key under different parents', async () => {
    const { call } = setup();
    await call('knowledge_page', { op: 'write', page: 'org:acme#policies/refund', body: 'Refunds within 30 days.' });
    await call('knowledge_page', { op: 'write', page: 'org:acme#handbook/refund', body: 'See the policy.' });
    expect((await call('knowledge_read', { page: 'org:acme#policies/refund' })).page.body).toBe(
      'Refunds within 30 days.',
    );
    expect((await call('knowledge_read', { page: 'org:acme#handbook/refund' })).page.body).toBe('See the policy.');
    await expect(call('knowledge_read', { page: 'org:acme#refund' })).rejects.toThrow(/not found/);
    await expect(call('knowledge_read', { page: 'org:acme#policies#refund' })).rejects.toThrow(/not found/);
  });

  it('delivers a config pin by path every run, and silently delivers nothing once the page moves', async () => {
    const { call, delivered } = setup();
    const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
    const debug = vi.spyOn(ConsoleLogger.prototype, 'debug');
    const error = vi.spyOn(ConsoleLogger.prototype, 'error');
    try {
      await call('knowledge_page', { op: 'write', page: 'org:acme#policies/refund', body: 'Refunds within 30 days.' });
      expect((await delivered()).join('\n')).toContain('Refunds within 30 days.');

      await call('knowledge_page', { op: 'move', page: 'org:acme#policies/refund', scope: 'org:acme' });
      expect(await call('knowledge_read', { page: 'org:acme#refund' })).toBeTruthy();
      expect(await delivered()).toEqual([]);

      // Runs re-create missing template pages, so an empty page reappears at the path; once it has a
      // body, the pin delivers it.
      const moved = await call('knowledge_read', { page: 'org:acme#refund' });
      const recreated = await call('knowledge_read', { page: 'org:acme#policies/refund' });
      expect(recreated.page.id).not.toBe(moved.page.id);
      await call('knowledge_page', { op: 'write', page: 'org:acme#policies/refund', body: 'Refunds within 14 days.' });
      expect((await delivered()).join('\n')).toContain('Refunds within 14 days.');

      expect([...warn.mock.calls, ...debug.mock.calls, ...error.mock.calls]).toEqual([]);
    } finally {
      warn.mockRestore();
      debug.mockRestore();
      error.mockRestore();
    }
  });
});
