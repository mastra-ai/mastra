import { MastraA2AError } from '@mastra/core/a2a';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { A2AConfig } from '@mastra/core/server';
import { describe, expect, it } from 'vitest';
import { assertA2AProtocolVersion, resolveA2AProtocolVersions } from './protocol-versions';

function createMastra(a2a?: A2AConfig) {
  return new Mastra({
    logger: false,
    agents: {
      concierge: new Agent({
        id: 'canonical-agent',
        name: 'Concierge',
        instructions: 'Help',
        model: 'openai/gpt-4o-mini',
      }),
      other: new Agent({ id: 'other-agent', name: 'Other', instructions: 'Help', model: 'openai/gpt-4o-mini' }),
    },
    server: { a2a },
  });
}

describe('A2A protocol exposure policy', () => {
  it('defaults to both versions', () => {
    expect(resolveA2AProtocolVersions(createMastra(), 'canonical-agent')).toEqual(['0.3', '1.0']);
  });

  it('inherits global configuration and replaces it for individual agents', () => {
    const mastra = createMastra({ protocolVersions: ['0.3'], agents: { concierge: { protocolVersions: ['1.0'] } } });
    expect(resolveA2AProtocolVersions(mastra, 'canonical-agent')).toEqual(['1.0']);
    expect(resolveA2AProtocolVersions(mastra, 'concierge')).toEqual(['1.0']);
    expect(resolveA2AProtocolVersions(mastra, 'other-agent')).toEqual(['0.3']);
  });

  it('prefers canonical ID overrides over registration keys', () => {
    const mastra = createMastra({
      agents: { concierge: { protocolVersions: ['0.3'] }, 'canonical-agent': { protocolVersions: ['1.0'] } },
    });
    expect(resolveA2AProtocolVersions(mastra, 'concierge')).toEqual(['1.0']);
    expect(resolveA2AProtocolVersions(mastra, 'canonical-agent')).toEqual(['1.0']);
  });

  it('supports stored agents without registration keys', () => {
    const mastra = createMastra({ agents: { stored: { protocolVersions: ['1.0'] } } });
    expect(resolveA2AProtocolVersions(mastra, 'stored')).toEqual(['1.0']);
  });

  it('inherits when an override omits its version list', () => {
    expect(
      resolveA2AProtocolVersions(
        createMastra({ protocolVersions: ['1.0'], agents: { concierge: {} } }),
        'canonical-agent',
      ),
    ).toEqual(['1.0']);
  });

  it('deduplicates without reordering or mutating configuration', () => {
    const config: A2AConfig = { protocolVersions: ['1.0', '0.3', '1.0'] };
    expect(resolveA2AProtocolVersions(createMastra(config), 'canonical-agent')).toEqual(['1.0', '0.3']);
    expect(config.protocolVersions).toEqual(['1.0', '0.3', '1.0']);
  });

  it('allows empty global and per-agent lists', () => {
    expect(resolveA2AProtocolVersions(createMastra({ protocolVersions: [] }), 'canonical-agent')).toEqual([]);
    const mastra = createMastra({ agents: { concierge: { protocolVersions: [] } } });
    expect(resolveA2AProtocolVersions(mastra, 'canonical-agent')).toEqual([]);
    expect(resolveA2AProtocolVersions(mastra, 'other-agent')).toEqual(['0.3', '1.0']);
    expect(() => assertA2AProtocolVersion(mastra, 'concierge', '0.3')).toThrow(MastraA2AError);
    expect(() => assertA2AProtocolVersion(mastra, 'canonical-agent', '1.0')).toThrow(MastraA2AError);
  });

  it('rejects disabled versions and accepts enabled versions', () => {
    const mastra = createMastra({ protocolVersions: ['1.0'] });
    expect(() => assertA2AProtocolVersion(mastra, 'canonical-agent', '0.3')).toThrow('Version not supported: 0.3');
    expect(() => assertA2AProtocolVersion(mastra, 'canonical-agent', '1.0')).not.toThrow();
  });

  it('rejects invalid runtime versions rather than silently enabling defaults', () => {
    const config: A2AConfig = {};
    Object.assign(config, { protocolVersions: ['2.0'] });
    expect(() => resolveA2AProtocolVersions(createMastra(config), 'canonical-agent')).toThrow(
      'Version not supported: 2.0',
    );
    Object.assign(config, { protocolVersions: '1.0' });
    expect(() => resolveA2AProtocolVersions(createMastra(config), 'canonical-agent')).toThrow(
      'A2A protocolVersions must be an array',
    );
  });
});
