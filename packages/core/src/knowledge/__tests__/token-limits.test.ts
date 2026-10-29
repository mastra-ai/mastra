import { estimateTokenCount } from 'tokenx';
import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { PIN_TRUNCATION_MARKER } from '../pinned';

const scopes = knowledgeMemoryScopes();

function run(knowledge: Knowledge) {
  const tools = knowledge.createTools();
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, ['org:acme']);
  const context = { requestContext, agent: { agentId: 'a', resourceId: 'u-1', threadId: 't-1' } };
  return {
    context,
    call: (tool: string, input: Record<string, unknown>) =>
      tools[tool]!.execute!(input as never, context as never) as Promise<any>,
  };
}

describe('Knowledge limits are counted in tokens', () => {
  it('refuses a note over 250 tokens and a description over 100, pointing at the page body', async () => {
    const { call } = run(new Knowledge({ storage: new InMemoryStore(), scopes, tools: true }));
    await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Runbook' });
    // ~1,000 characters of short words: well under the old 1,000-character limit's spirit, over 250 tokens.
    const long = 'a b '.repeat(300);
    expect(estimateTokenCount(long)).toBeGreaterThan(250);
    await expect(
      call('knowledge_note', { op: 'add', page: 'Runbook', scope: ['org:acme'], text: long }),
    ).rejects.toThrow(/250 token limit.*page body/);
    await expect(call('knowledge_page', { op: 'write', page: 'Runbook', description: long })).rejects.toThrow(
      /100 token limit.*page body/,
    );
    await expect(call('knowledge_page', { op: 'write', page: 'Runbook', body: long })).resolves.toBeTruthy();
  });

  it('bounds delivered pins by estimated tokens and truncates with a pointer to knowledge_read', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore(),
      scopes,
      tools: true,
      pinnedContext: { maxTokens: 100 },
    });
    const { call, context } = run(knowledge);
    await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Style', body: 'word '.repeat(400) });
    await call('knowledge_pin', { op: 'pin', page: 'Style', audience: ['org:acme'] });

    const pins = await knowledge.__deliveredPins(context as never);
    expect(pins).toHaveLength(1);
    expect(pins[0]!.text).toContain(PIN_TRUNCATION_MARKER);
    expect(estimateTokenCount(pins.map(pin => pin.text).join(''))).toBeLessThanOrEqual(100);
  });

  it('accepts a pin budget up to 2000 tokens and refuses one over', () => {
    expect(() => new Knowledge({ scopes, pinnedContext: { maxTokens: 2_000 } })).not.toThrow();
    expect(() => new Knowledge({ scopes, pinnedContext: { maxTokens: 2_001 } })).toThrow(/at most 2000/);
  });
});
