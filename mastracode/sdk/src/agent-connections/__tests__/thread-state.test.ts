import { describe, expect, it } from 'vitest';

import { normalizeConnectedPeers, normalizeSentAgentSignals } from '../thread-state.js';

describe('normalizeConnectedPeers', () => {
  it('drops persisted peers whose identity fields are not strings', () => {
    const peers = normalizeConnectedPeers([
      { id: 123, resourceId: 'r', threadId: 't' },
      { id: 'ok', resourceId: { nested: true }, threadId: 't' },
      { id: 'ok-2', resourceId: 'r', threadId: 42 },
      { id: 'ok-3', resourceId: 'r', threadId: 't', agentId: 7 },
      { id: 'valid', resourceId: 'r', threadId: 't', agentId: 'code-agent' },
    ]);

    expect(peers.map(peer => peer.id)).toEqual(['valid']);
  });

  it('coerces non-string metadata fields to undefined', () => {
    const peers = normalizeConnectedPeers([
      { id: 'peer', resourceId: 'r', threadId: 't', label: 5, title: {}, mode: [], pid: 'not-a-number' },
    ]);

    expect(peers).toHaveLength(1);
    expect(peers[0]).toMatchObject({ id: 'peer', resourceId: 'r', threadId: 't' });
    expect(peers[0]?.label).toBeUndefined();
    expect(peers[0]?.title).toBeUndefined();
    expect(peers[0]?.mode).toBeUndefined();
    expect(peers[0]?.pid).toBeUndefined();
  });
});

describe('normalizeSentAgentSignals', () => {
  const validSignal = {
    messageId: 'message-1',
    fingerprint: 'fingerprint-1',
    targetId: 'code-agent:resource-2:thread-2',
    priority: 'high',
    expectsReply: true,
    replyTo: 'request-1',
    returnPeerId: 'code-agent:resource-1:thread-1',
    routingAction: 'deliver',
    runId: 'run-1',
    sentAt: 1_000,
  };

  it('keeps valid persisted sent-signal records', () => {
    expect(normalizeSentAgentSignals([validSignal])).toEqual([validSignal]);
  });

  it('drops persisted sent-signal records with malformed fields', () => {
    const malformed = [
      { ...validSignal, messageId: 1 },
      { ...validSignal, fingerprint: {} },
      { ...validSignal, targetId: [] },
      { ...validSignal, priority: 'invalid' },
      { ...validSignal, expectsReply: 'yes' },
      { ...validSignal, replyTo: 1 },
      { ...validSignal, returnPeerId: {} },
      { ...validSignal, routingAction: 'invalid' },
      { ...validSignal, runId: 1 },
      { ...validSignal, sentAt: Number.NaN },
      { ...validSignal, sentAt: Number.POSITIVE_INFINITY },
    ];

    expect(normalizeSentAgentSignals([...malformed, validSignal])).toEqual([validSignal]);
  });
});
