import { describe, expect, it } from 'vitest';
import { MastraA2AError } from '../error';
import { negotiateAgentCard } from './negotiate';
import { v0_3Compat } from './v0_3';
import { v1Compat } from './v1';

const cardMetadata = {
  name: 'Remote Agent',
  description: 'A remote agent',
  version: '9.0',
  capabilities: { streaming: true },
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [],
};
const legacyCard = {
  ...cardMetadata,
  url: 'https://remote.example.com/legacy',
  protocolVersion: '0.3.0',
};

const v1Interface = {
  protocolVersion: '1.0',
  protocolBinding: 'JSONRPC',
  url: 'https://remote.example.com/v1',
};
const v0_3Interface = {
  protocolVersion: '0.3',
  protocolBinding: 'JSONRPC',
  url: 'https://remote.example.com/v0',
};

function cardWithInterfaces(supportedInterfaces: unknown) {
  return { ...cardMetadata, supportedInterfaces };
}

describe('negotiateAgentCard', () => {
  it.each([
    [v0_3Interface, v1Interface],
    [v1Interface, v0_3Interface],
  ])('prefers v1 independent of interface order (%j, %j)', (first, second) => {
    const result = negotiateAgentCard(cardWithInterfaces([first, second]));
    expect(result.compat).toBe(v1Compat);
    expect(result.card).toMatchObject({ url: v1Interface.url, protocolVersion: '1.0' });
  });

  it.each([
    { agentInterface: v1Interface, compat: v1Compat },
    { agentInterface: v0_3Interface, compat: v0_3Compat },
  ])('normalizes a single $agentInterface.protocolVersion interface', ({ agentInterface, compat }) => {
    const result = negotiateAgentCard(cardWithInterfaces([agentInterface]));
    expect(result.compat).toBe(compat);
    expect(result.card).toMatchObject({
      name: legacyCard.name,
      description: legacyCard.description,
      url: agentInterface.url,
      preferredTransport: 'JSONRPC',
      protocolVersion: agentInterface.protocolVersion,
      version: '9.0',
      capabilities: { streaming: true },
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
      skills: [],
    });
  });

  it('matches JSONRPC case-insensitively and ignores other transports and unsupported versions', () => {
    const result = negotiateAgentCard(
      cardWithInterfaces([
        { ...v1Interface, protocolBinding: 'GRPC' },
        { ...v1Interface, protocolVersion: '2.0' },
        { ...v0_3Interface, protocolBinding: 'jsonrpc' },
      ]),
    );
    expect(result.compat).toBe(v0_3Compat);
    expect(result.card.url).toBe(v0_3Interface.url);
  });

  it('chooses the first usable interface within the preferred version', () => {
    const result = negotiateAgentCard(
      cardWithInterfaces([
        null,
        {},
        { ...v1Interface, url: 'file:///private/card' },
        { ...v1Interface, url: '' },
        v1Interface,
        { ...v1Interface, url: 'https://remote.example.com/second' },
      ]),
    );
    expect(result.compat).toBe(v1Compat);
    expect(result.card.url).toBe(v1Interface.url);
  });

  it.each(['/relative', 'https://user:secret@remote.example.com/rpc'])(
    'chooses a usable v0.3 interface over invalid v1 endpoint %s',
    url => {
      const result = negotiateAgentCard(cardWithInterfaces([{ ...v1Interface, url }, v0_3Interface]));
      expect(result.compat).toBe(v0_3Compat);
      expect(result.card.url).toBe(v0_3Interface.url);
    },
  );

  it('uses legacy URL fallback without interpreting the application version', () => {
    const result = negotiateAgentCard(legacyCard);
    expect(result.compat).toBe(v0_3Compat);
    expect(result.card).toBe(legacyCard);
    expect(result.card.protocolVersion).toBe('0.3.0');
  });

  it.each(['1.0', '0.3', '2.0', '2026-09-17'])('ignores application version %s during interface selection', version => {
    const result = negotiateAgentCard({ ...cardWithInterfaces([v1Interface, v0_3Interface]), version });
    expect(result.compat).toBe(v1Compat);
    expect(result.card.version).toBe(version);
  });

  it.each([
    undefined,
    null,
    {},
    'JSONRPC',
    [],
    [null],
    [{}],
    [{ ...v1Interface, protocolVersion: '2.0' }],
    [{ ...v1Interface, protocolBinding: 'GRPC' }],
  ])('never falls back to the legacy URL when supportedInterfaces is present: %j', supportedInterfaces => {
    expect(() => negotiateAgentCard({ ...legacyCard, supportedInterfaces })).toThrow(
      'Remote A2A agent card must advertise a JSONRPC interface for protocol version 1.0 or 0.3 with an HTTP(S) execution URL.',
    );
  });

  it.each([
    '',
    ' ',
    '/relative',
    'not a URL',
    'file:///tmp/agent',
    'ftp://remote.example.com',
    'https://user:secret@remote.example.com',
    null,
    42,
  ])('rejects invalid legacy and advertised URLs: %j', url => {
    expect(() => negotiateAgentCard({ ...legacyCard, url })).toThrow(MastraA2AError);
    expect(() => negotiateAgentCard(cardWithInterfaces([{ ...v1Interface, url }]))).toThrow(MastraA2AError);
  });

  it('accepts HTTP execution URLs', () => {
    const url = 'http://localhost:4111/a2a';
    expect(negotiateAgentCard({ ...legacyCard, url }).card.url).toBe(url);
    expect(negotiateAgentCard(cardWithInterfaces([{ ...v1Interface, url }])).card.url).toBe(url);
  });

  it.each([null, undefined, [], 'card', 42])('rejects non-object cards: %j', value => {
    expect(() => negotiateAgentCard(value)).toThrow('Remote A2A agent card must be an object.');
  });

  it('rejects a legacy card without an execution URL', () => {
    expect(() => negotiateAgentCard({ name: 'Remote Agent' })).toThrow(
      'Remote legacy A2A agent card must advertise an HTTP(S) execution URL.',
    );
  });

  it('does not include remote credentials or card content in negotiation errors', () => {
    try {
      negotiateAgentCard({ ...legacyCard, url: 'https://user:secret@remote.example.com', supportedInterfaces: [] });
      expect.fail('Expected negotiation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(MastraA2AError);
      expect(String(error)).not.toContain('secret');
      expect(String(error)).not.toContain('Remote Agent');
    }
  });
});
