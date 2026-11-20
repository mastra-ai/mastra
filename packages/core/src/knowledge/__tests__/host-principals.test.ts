import { describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '../../storage/mock';
import { KnowledgeDeclarationError, knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { agentRunContext } from './agent-run-context';

const scopes = {
  ...knowledgeMemoryScopes({ org: 'org:$orgId' }),
  'agent:$agentId': { access: [{ principal: 'self' as const, role: 'owner' as const }] },
  'shared:$orgId': { access: [{ principal: 'agent:claude-code' as const, role: 'viewer' as const }] },
};

async function setup() {
  const knowledge = new Knowledge({ id: 'kb', storage: new InMemoryStore(), scopes });
  await knowledge.upsertPage({ scope: 'agent:claude-code', path: 'mine', name: 'Mine', body: 'claude notes' });
  await knowledge.upsertPage({ scope: 'agent:cursor', path: 'theirs', name: 'Theirs', body: 'cursor notes' });
  await knowledge.upsertPage({ scope: 'shared:acme', path: 'handbook', name: 'Handbook', body: 'handbook' });
  return knowledge;
}

type ToolMap = Record<string, { execute?: (input: any, context: any) => Promise<any> }>;
const call = (tools: ToolMap, name: string, input: unknown, context: unknown = {}) =>
  tools[name]!.execute!(input, context);

describe('createTools({ principals }) for hosts acting outside an agent run', () => {
  it('runs with no agent run context, under the host-supplied principals', async () => {
    const knowledge = await setup();
    const tools = knowledge.createTools({ read: true, write: true, principals: ['agent:claude-code'] }) as ToolMap;

    const mine = await call(tools, 'knowledge_read', { page: 'agent:claude-code#mine' });
    expect(JSON.stringify(mine)).toContain('claude notes');
    const shared = await call(tools, 'knowledge_read', { page: 'shared:acme#handbook' });
    expect(JSON.stringify(shared)).toContain('handbook');
  });

  it("refuses pages the principals' scope rules don't reach", async () => {
    const knowledge = await setup();
    const tools = knowledge.createTools({ read: true, write: true, principals: ['agent:claude-code'] }) as ToolMap;

    await expect(call(tools, 'knowledge_read', { page: 'agent:cursor#theirs' })).rejects.toThrow();
    const found = await call(tools, 'knowledge_search', { query: 'cursor notes' });
    expect(JSON.stringify(found)).not.toContain('Theirs');
  });

  it('ignores run scopes on the call context: the host principals are the only ones', async () => {
    const knowledge = await setup();
    const tools = knowledge.createTools({ read: true, write: true, principals: ['agent:claude-code'] }) as ToolMap;

    const forged = agentRunContext('cursor', ['agent:cursor']);
    await expect(call(tools, 'knowledge_read', { page: 'agent:cursor#theirs' }, forged)).rejects.toThrow();
  });

  it('writes within the scope rules and records the host-supplied author', async () => {
    const knowledge = await setup();
    const tools = knowledge.createTools({
      read: true,
      write: true,
      principals: ['agent:claude-code'],
      author: 'user:u1 via mcp:claude-code',
    }) as ToolMap;

    await call(tools, 'knowledge_note', {
      op: 'add',
      page: 'agent:claude-code#mine',
      text: 'from claude',
      scope: ['agent:claude-code'],
    });
    const read = await call(tools, 'knowledge_read', { page: 'agent:claude-code#mine' });
    expect(JSON.stringify(read)).toContain('from claude');
    expect(JSON.stringify(read)).toContain('user:u1 via mcp:claude-code');

    // A viewer on shared:acme can't write there.
    await expect(
      call(tools, 'knowledge_note', { op: 'add', page: 'shared:acme#handbook', text: 'nope', scope: ['shared:acme'] }),
    ).rejects.toThrow();
  });

  it('refuses an undeclared principal on the first call', async () => {
    const knowledge = new Knowledge({ id: 'kb', storage: new InMemoryStore(), scopes });
    const tools = knowledge.createTools({ read: true, principals: ['vendor:x'] }) as ToolMap;
    await expect(call(tools, 'knowledge_search', { query: 'anything' })).rejects.toThrow(KnowledgeDeclarationError);
  });

  it('refuses an empty principal list', () => {
    const knowledge = new Knowledge({ id: 'kb', storage: new InMemoryStore(), scopes });
    expect(() => knowledge.createTools({ principals: [] })).toThrow(/at least one/);
  });

  it('keeps run-scope behaviour unchanged without `principals`', async () => {
    const knowledge = await setup();
    const tools = knowledge.createTools({ read: true, write: true }) as ToolMap;
    await expect(call(tools, 'knowledge_read', { page: 'agent:claude-code#mine' }, {})).rejects.toThrow(
      /need run scopes/,
    );
    const viaRun = await call(
      tools,
      'knowledge_read',
      { page: 'agent:cursor#theirs' },
      agentRunContext('cursor', ['agent:cursor']),
    );
    expect(JSON.stringify(viaRun)).toContain('cursor notes');
  });
});

describe('getPinnedContext({ principals })', () => {
  it('returns the pins those principals receive, and only pages they can read', async () => {
    const knowledge = await setup();
    const storage = await knowledge.getStorage();
    const pages = await storage.getScopesByAddress(['agent:claude-code', 'agent:cursor']);
    const page = async (scopeAddress: string, key: string) =>
      (await storage.getPageByPath({
        scopeId: pages.find(p => p.address === scopeAddress)!.id,
        path: [key],
        read: 'all',
      }))!;
    await storage.addPinAudience({
      pageId: (await page('agent:claude-code', 'mine')).id,
      audience: ['agent:claude-code'],
      createdBy: 'host',
    });
    // Pinned for claude-code, but on a page it can't read: never delivered.
    await storage.addPinAudience({
      pageId: (await page('agent:cursor', 'theirs')).id,
      audience: ['agent:claude-code'],
      createdBy: 'host',
    });

    const pins = await knowledge.getPinnedContext({ principals: ['agent:claude-code'] });
    expect(pins.map(pin => pin.name)).toEqual(['Mine']);
    expect(pins[0]!.text).toContain('claude notes');
    expect(await knowledge.getPinnedContext({ principals: ['agent:other'] })).toEqual([]);
  });

  it('refuses undeclared principals', async () => {
    const knowledge = await setup();
    await expect(knowledge.getPinnedContext({ principals: ['vendor:x'] })).rejects.toThrow(KnowledgeDeclarationError);
    await expect(knowledge.getPinnedContext({ principals: [] })).rejects.toThrow(/at least one/);
  });
});

describe('principals of a scope type only the store declares', () => {
  // `partner:$orgId` exists only in the store's declarations, which load when the runtime first resolves.
  async function storeDeclared() {
    const storage = new InMemoryStore();
    const knowledgeStore = await storage.getStore('knowledge');
    vi.spyOn(knowledgeStore!, 'getScopeDeclarations').mockResolvedValue({
      'partner:$orgId': { access: [{ principal: 'self', role: 'owner' }] },
    });
    const writer = new Knowledge({ id: 'kb', storage, scopes });
    const { page } = await writer.upsertPage({
      scope: 'partner:acme',
      path: 'brief',
      name: 'Brief',
      body: 'partner brief',
    });
    await (
      await writer.getStorage()
    ).addPinAudience({ pageId: page.id, audience: ['partner:acme'], createdBy: 'host' });
    // A fresh instance over the same store: nothing has resolved its declarations yet.
    return new Knowledge({ id: 'kb', storage, scopes });
  }

  it('createTools accepts them on a cold instance and reads under them', async () => {
    const knowledge = await storeDeclared();
    const tools = knowledge.createTools({ read: true, principals: ['partner:acme'] }) as ToolMap;
    const page = await call(tools, 'knowledge_read', { page: 'partner:acme#brief' });
    expect(JSON.stringify(page)).toContain('partner brief');
  });

  it('getPinnedContext accepts them on a cold instance', async () => {
    const knowledge = await storeDeclared();
    const pins = await knowledge.getPinnedContext({ principals: ['partner:acme'] });
    expect(pins.map(pin => pin.name)).toEqual(['Brief']);
  });
});
