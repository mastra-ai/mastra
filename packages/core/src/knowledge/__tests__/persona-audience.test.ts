import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../storage';
import { Knowledge, knowledgeAgentScopes } from '../index';

async function fixture(audience: string, editor: boolean) {
  const declarations = knowledgeAgentScopes();
  for (const key of Object.keys(declarations)) {
    declarations[key] = { ...declarations[key], access: [{ principal: 'self', role: editor ? 'editor' : 'viewer' }] };
  }
  const knowledge = new Knowledge({
    storage: new InMemoryStore(),
    tools: true,
    pinnedContext: true,
    scopes: { ...declarations, 'kb:$kbId': { access: [{ principal: 'self', role: 'editor' }] } },
  });
  await knowledge.upsertPage({ scope: 'kb:docs', path: 'policy', name: 'Policy', body: 'Refund policy.' });
  const tools = knowledge.createTools({ principals: ['kb:docs', audience] });
  const pin = (op: 'pin' | 'unpin', kind: 'page' | 'list') =>
    tools.knowledge_pin!.execute!(
      {
        op,
        kind,
        page: 'kb:docs#policy',
        audience: [audience],
      },
      {},
    );
  return { pin };
}

describe('shared persona pin authority', () => {
  it.each([
    'agent:persona:role:support',
    'agent:persona:role:support:org:acme',
    'agent:persona:role:support:user:u1',
    'agent:persona:team:billing',
  ])('requires editor on held shared audience %s for page and list pins', async audience => {
    const viewer = await fixture(audience, false);
    for (const kind of ['page', 'list'] as const) {
      await expect(viewer.pin('pin', kind)).rejects.toThrow(/editor/);
      await expect(viewer.pin('unpin', kind)).rejects.toThrow(/editor/);
    }
    const editor = await fixture(audience, true);
    for (const kind of ['page', 'list'] as const) {
      await expect(editor.pin('pin', kind)).resolves.toBeDefined();
      await expect(editor.pin('unpin', kind)).resolves.toBeDefined();
    }
  });

  it('keeps the holding shortcut for an individual agent identity', async () => {
    const { pin } = await fixture('agent:a1', false);
    await expect(pin('pin', 'page')).resolves.toBeDefined();
    await expect(pin('unpin', 'page')).resolves.toBeDefined();
  });
});
