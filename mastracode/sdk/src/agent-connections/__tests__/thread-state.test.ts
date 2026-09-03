import { describe, expect, it } from 'vitest';

import { normalizeConnectedPeers } from '../thread-state.js';

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
