import { describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { PinnedStateProcessor } from '../pinned-state-processor';

// A hosted Knowledge (Platform's) declares no scopes in code: the store serves all of them, Memory's
// included. Pins must still reach a run's first turn, before any Knowledge tool has loaded them.
describe('pinned context when the store declares the scopes', () => {
  it('delivers pins on the first turn, before any tool call', async () => {
    const store = new InMemoryStore({ id: 'pins-store-declared' });
    const seeding = new Knowledge({ storage: store, scopes: knowledgeMemoryScopes() });
    const { page } = await seeding.upsertPage({
      scope: 'resource:user-42',
      path: 'roadmap',
      name: 'Roadmap',
      body: 'Ship the pixel office.',
    });
    const storage = await seeding.getStorage();
    await storage.addPinAudience({ pageId: page.id, audience: ['resource:user-42'], createdBy: 'test' });

    const knowledge = new Knowledge({ storage: store, scopes: {}, tools: true, pinnedContext: true });
    vi.spyOn(await knowledge.getStorage(), 'getScopeDeclarations').mockResolvedValue(knowledgeMemoryScopes());
    const processor = new PinnedStateProcessor({
      principalsKey: run => knowledge.__principalsKey(run),
      readPins: run => knowledge.__deliveredPins(run),
    });

    const signal = await processor.computeStateSignal({
      threadId: 'alpha',
      resourceId: 'user-42',
      stepNumber: 0,
      requestContext: new RequestContext(),
      contextWindow: { hasSnapshot: false },
      lastSnapshot: undefined,
      deltasSinceSnapshot: [],
    } as any);

    expect(signal).toMatchObject({ mode: 'snapshot' });
    expect(signal!.contents).toContain('Ship the pixel office.');
  });
});
