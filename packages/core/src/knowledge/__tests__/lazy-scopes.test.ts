import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

function setup() {
  const storage = new InMemoryStore();
  const knowledge = new Knowledge({
    storage,
    tools: true,
    scopes: {
      ...knowledgeMemoryScopes(),
      'project:$projectId': {
        belongsTo: 'org:$orgId',
        access: [{ principal: 'self', role: 'owner' }],
        pages: [{ key: 'overview', name: 'Overview' }],
      },
    },
  });
  const tools = knowledge.createTools({ write: true });
  const context = (held: string[], agent: Record<string, string> = {}) => {
    const requestContext = new RequestContext();
    if (held.length) setRunAgentScopes(requestContext, held);
    return { requestContext, agent: { agentId: 'a', ...agent } };
  };
  const call = (held: string[], tool: string, input: Record<string, unknown>, agent?: Record<string, string>) =>
    tools[tool]!.execute!(input as never, context(held, agent) as never) as Promise<any>;
  const scopes = async (addresses: string[]) =>
    (await knowledge.getStorage()).getScopesByAddress(addresses).then(found => found.map(scope => scope.address));
  return { knowledge, call, context, scopes };
}

const SLACK_USER = { resourceId: 'slack:U123', threadId: 'slack:C1:1700000000.0001' };

describe('Knowledge scopes materialize on first write', () => {
  it('creates no scope pages for read-only runs: search, list, read and pinned-context delivery', async () => {
    const { knowledge, call, context, scopes } = setup();
    const held = ['org:acme', 'project:p1'];

    await call(held, 'knowledge_search', { query: 'refund policy' }, SLACK_USER);
    await call(held, 'knowledge_list', {}, SLACK_USER);
    await expect(call(held, 'knowledge_read', { page: 'project:p1' }, SLACK_USER)).rejects.toThrow(/not found/);
    await expect(call(held, 'knowledge_read', { page: 'project:p1#overview' }, SLACK_USER)).rejects.toThrow(
      /not found/,
    );
    await knowledge.__deliveredPins(context(held, SLACK_USER));

    expect(
      await scopes(['org:acme', 'project:p1', `resource:${SLACK_USER.resourceId}`, `thread:${SLACK_USER.threadId}`]),
    ).toEqual([]);
  });

  it('a write still materializes the held scopes with their template pages', async () => {
    const { call, scopes } = setup();
    await call(['project:p1'], 'knowledge_page', { op: 'write', scope: 'project:p1', name: 'Plan', body: 'x' });

    expect(await scopes(['project:p1'])).toEqual(['project:p1']);
    expect((await call(['project:p1'], 'knowledge_read', { page: 'project:p1#overview' })).page.name).toBe('Overview');
  });

  it('late-links on a later write, not on a read', async () => {
    const { knowledge, call } = setup();
    const storage = await knowledge.getStorage();
    await call(['project:p1'], 'knowledge_page', { op: 'write', scope: 'project:p1', name: 'Plan', body: 'x' });

    await call(['project:p1', 'org:acme'], 'knowledge_search', { query: 'plan' });
    let [project] = await storage.getScopesByAddress(['project:p1']);
    expect(project!.parentId).toBeNull();
    expect(await storage.getScopesByAddress(['org:acme'])).toEqual([]);

    await call(['project:p1', 'org:acme'], 'knowledge_note', {
      op: 'add',
      page: 'project:p1#overview',
      scope: ['project:p1'],
      text: 'Kickoff Monday.',
    });
    [project] = await storage.getScopesByAddress(['project:p1']);
    const [acme] = await storage.getScopesByAddress(['org:acme']);
    expect(project!.parentId).toBe(acme!.id);
  });
});
