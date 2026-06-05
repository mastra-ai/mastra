import { describe, it, expect } from 'vitest';

import type { Config, UserOutcome } from '../../../types';
import { mapConfigToCreateInput, type MapConfigToCreateInputDeps } from '../handler';

const userOutcome: UserOutcome = {
  goal: 'Help users',
  audience: 'everyone',
  capabilities: [],
  tone: 'friendly',
  successCriteria: [],
};

const deps: MapConfigToCreateInputDeps = {
  id: 'agent-123',
  visibility: 'private',
  model: { provider: 'openai', name: 'gpt-5.5' },
  requestContextSchema: { type: 'object' },
};

function baseConfig(overrides: Partial<Config> = {}): Config {
  return { userOutcome, name: 'Helper', instructions: 'Do things', ...overrides };
}

describe('mapConfigToCreateInput', () => {
  it('maps required fields and create-time deps', () => {
    const input = mapConfigToCreateInput(baseConfig(), deps);
    expect(input.id).toBe('agent-123');
    expect(input.visibility).toBe('private');
    expect(input.name).toBe('Helper');
    expect(input.instructions).toBe('Do things');
    expect(input.model).toEqual({ provider: 'openai', name: 'gpt-5.5' });
    expect(input.requestContextSchema).toEqual({ type: 'object' });
  });

  it('falls back to a non-empty name when blank', () => {
    expect(mapConfigToCreateInput(baseConfig({ name: '   ' }), deps).name).toBe('Untitled Agent');
    expect(mapConfigToCreateInput(baseConfig({ name: undefined }), deps).name).toBe('Untitled Agent');
  });

  it('defaults instructions to an empty string when absent', () => {
    expect(mapConfigToCreateInput(baseConfig({ instructions: undefined }), deps).instructions).toBe('');
  });

  it('trims description and omits it when empty', () => {
    expect(mapConfigToCreateInput(baseConfig({ description: '  hi  ' }), deps).description).toBe('hi');
    expect(mapConfigToCreateInput(baseConfig({ description: '   ' }), deps).description).toBeUndefined();
    expect(mapConfigToCreateInput(baseConfig(), deps).description).toBeUndefined();
  });

  it('builds an id workspace ref when a workspaceId is present', () => {
    expect(mapConfigToCreateInput(baseConfig({ workspaceId: 'ws-1' }), deps).workspace).toEqual({
      type: 'id',
      workspaceId: 'ws-1',
    });
    expect(mapConfigToCreateInput(baseConfig({ workspaceId: '' }), deps).workspace).toBeUndefined();
    expect(mapConfigToCreateInput(baseConfig(), deps).workspace).toBeUndefined();
  });

  it('maps enabled tools/agents/workflows/skills to stored records and omits disabled/empty', () => {
    const input = mapConfigToCreateInput(
      baseConfig({
        tools: { t1: true, t2: false },
        agents: { a1: true },
        workflows: { w1: true, w2: false },
        skills: { s1: true, s2: false },
      }),
      deps,
    );
    expect(input.tools).toEqual({ t1: {} });
    expect(input.agents).toEqual({ a1: {} });
    expect(input.workflows).toEqual({ w1: {} });
    expect(input.skills).toEqual({ s1: {} });
  });

  it('omits selection records entirely when nothing is enabled', () => {
    const input = mapConfigToCreateInput(baseConfig({ tools: { t1: false }, skills: {} }), deps);
    expect(input.tools).toBeUndefined();
    expect(input.skills).toBeUndefined();
    expect(input.agents).toBeUndefined();
    expect(input.workflows).toBeUndefined();
  });

  it('persists the browser ref only when enabled and a ref is provided', () => {
    const browserRef = { type: 'inline', config: { provider: 'playwright' } } as MapConfigToCreateInputDeps['browserRef'];

    expect(mapConfigToCreateInput(baseConfig({ browserEnabled: true }), { ...deps, browserRef }).browser).toEqual(
      browserRef,
    );
    // Enabled but no ref ⇒ dropped.
    expect(mapConfigToCreateInput(baseConfig({ browserEnabled: true }), deps).browser).toBeUndefined();
    // Ref available but not enabled ⇒ dropped.
    expect(
      mapConfigToCreateInput(baseConfig({ browserEnabled: false }), { ...deps, browserRef }).browser,
    ).toBeUndefined();
  });
});
