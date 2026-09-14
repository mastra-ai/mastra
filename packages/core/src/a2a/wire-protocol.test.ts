import { describe, expect, it } from 'vitest';
import { selectA2AInterface } from './wire-protocol';

describe('selectA2AInterface', () => {
  describe('bare-url 0.3 cards (C1 regression)', () => {
    // A2A 0.3 cards carry the endpoint as a top-level `url` and are not required to
    // self-identify a version. Before the C1 fix, such a card yielded no interface
    // under the `'auto'` default → versionNotSupported at the first generate().
    it('treats a top-level url with absent protocolVersion as a 0.3 interface (auto)', () => {
      const card = { url: 'https://remote.example.com/a2a/remote', name: 'legacy' };
      expect(selectA2AInterface(card, 'auto')).toEqual({
        protocolVersion: '0.3',
        url: 'https://remote.example.com/a2a/remote',
      });
    });

    it('treats a top-level url with absent protocolVersion as a 0.3 interface (pinned 0.3)', () => {
      const card = { url: 'https://remote.example.com/a2a/remote' };
      expect(selectA2AInterface(card, '0.3')).toEqual({
        protocolVersion: '0.3',
        url: 'https://remote.example.com/a2a/remote',
      });
    });

    it('still treats an explicit protocolVersion "0.3.0" top-level url as 0.3', () => {
      const card = { url: 'https://remote.example.com/a2a/remote', protocolVersion: '0.3.0' };
      expect(selectA2AInterface(card, 'auto')).toEqual({
        protocolVersion: '0.3',
        url: 'https://remote.example.com/a2a/remote',
      });
    });

    it('does NOT read a top-level url as 0.3 when the card advertises a different version', () => {
      // A card that explicitly says protocolVersion '1.0' must not be misread as a 0.3
      // interface via its top-level url — that would negotiate the wrong wire version.
      const card = { url: 'https://remote.example.com/a2a/remote', protocolVersion: '1.0' };
      expect(() => selectA2AInterface(card, '0.3')).toThrow();
    });
  });

  describe('supportedInterfaces negotiation', () => {
    const dualCard = {
      url: 'https://remote.example.com/a2a/remote',
      protocolVersion: '0.3.0',
      supportedInterfaces: [
        { url: 'https://remote.example.com/v1', protocolBinding: 'JSONRPC', protocolVersion: '1.0' },
        { url: 'https://remote.example.com/v03', protocolBinding: 'JSONRPC', protocolVersion: '0.3' },
      ],
    };

    it('auto picks the first advertised interface (1.0 for a dual card)', () => {
      expect(selectA2AInterface(dualCard, 'auto')).toEqual({
        protocolVersion: '1.0',
        url: 'https://remote.example.com/v1',
      });
    });

    it('pins to the requested version when advertised', () => {
      expect(selectA2AInterface(dualCard, '0.3')).toEqual({
        protocolVersion: '0.3',
        url: 'https://remote.example.com/v03',
      });
    });

    it('ignores non-JSONRPC interfaces', () => {
      const card = {
        supportedInterfaces: [
          { url: 'https://remote.example.com/grpc', protocolBinding: 'GRPC', protocolVersion: '1.0' },
        ],
      };
      expect(() => selectA2AInterface(card, 'auto')).toThrow();
    });
  });

  it('throws on a malformed (non-object) card', () => {
    expect(() => selectA2AInterface(null, 'auto')).toThrow(/malformed agent card/);
  });
});
