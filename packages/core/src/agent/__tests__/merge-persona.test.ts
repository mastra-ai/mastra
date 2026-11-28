import { describe, expect, it } from 'vitest';
import { RequestContext } from '../../request-context';
import { Agent, mergeAgentPersona } from '../index';

describe('mergeAgentPersona', () => {
  it('keeps unrelated metadata and code fields when a host field is unset', () => {
    const code = { app: 'billing', persona: { name: 'Sam', role: 'support', teamId: 'billing' } };
    const merged = mergeAgentPersona(code, { name: 'Pat', role: undefined, teamId: '' });
    expect(merged).toEqual({ app: 'billing', persona: { name: 'Pat', role: 'support', teamId: '' } });
    expect(code.persona.name).toBe('Sam');
  });

  it('wraps function metadata and forwards the normal run request context', async () => {
    const metadata = mergeAgentPersona(
      ({ requestContext }) => ({
        region: requestContext.get('region'),
        persona: { name: 'Sam', role: requestContext.get('role'), teamId: 'ops' },
      }),
      { name: 'Pat', teamId: '' },
    );
    const agent = new Agent({ id: 'a', name: 'a', instructions: 'x', model: 'openai/gpt-4o-mini', metadata });
    const requestContext = new RequestContext([
      ['region', 'eu'],
      ['role', 'support'],
    ]);
    expect(await agent.getMetadata({ requestContext })).toEqual({
      region: 'eu',
      persona: { name: 'Pat', role: 'support', teamId: '' },
    });
  });

  it('awaits async metadata and tolerates missing or malformed code persona', async () => {
    const metadata = mergeAgentPersona(async () => ({ other: true, persona: 'old' }), { role: 'support' });
    const agent = new Agent({ id: 'a', name: 'a', instructions: 'x', model: 'openai/gpt-4o-mini', metadata });
    expect(await agent.getMetadata()).toEqual({ other: true, persona: { role: 'support' } });
    expect(mergeAgentPersona(undefined, { role: 'support' })).toEqual({ persona: { role: 'support' } });
  });
});
