import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';
import { deriveConnectRequestState } from './connect-request';
import type { ConnectRequestData } from './connect-request';

const request: ConnectRequestData = {
  requestId: 'call_1',
  integration: 'linear',
  displayName: 'Linear',
  reason: 'File the bug.',
  connectionId: 'conn_1',
  connectUrl: 'https://example.com/connect',
  expiresAt: '2026-10-07T15:00:00Z',
  agentId: 'agent',
  threadId: 'thread',
  resourceId: 'resource',
};
const beforeExpiry = Date.parse('2026-10-07T14:00:00Z');
const afterExpiry = Date.parse('2026-10-07T16:00:00Z');

const persistedSignal = (attributes: Record<string, string>): MastraDBMessage => ({
  id: attributes.connectRequestId + attributes.outcome,
  role: 'signal',
  createdAt: new Date(),
  content: {
    format: 2,
    parts: [{ type: 'text', text: '' }],
    metadata: { signal: { type: 'notification', attributes } },
  },
});

const liveSignal = (attributes: Record<string, string>): MastraDBMessage => ({
  id: 'live',
  role: 'assistant',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'data-signal', data: { type: 'notification', attributes } }] },
});

describe('deriveConnectRequestState', () => {
  it('reads the outcome matching this request from persisted and live signals', () => {
    const connected = persistedSignal({ connectRequestId: 'call_1', outcome: 'connected', accountLabel: 'acme' });
    const otherRequest = liveSignal({ connectRequestId: 'call_2', outcome: 'failed' });
    expect(deriveConnectRequestState(request, [connected, otherRequest], 'waiting', afterExpiry)).toEqual({
      status: 'connected',
      accountLabel: 'acme',
    });
    const failed = liveSignal({ connectRequestId: 'call_1', outcome: 'failed' });
    expect(deriveConnectRequestState(request, [failed], undefined, beforeExpiry)).toEqual({ status: 'failed' });
  });

  it('uses local state until an outcome arrives, and expires only pending requests', () => {
    expect(deriveConnectRequestState(request, [], undefined, beforeExpiry)).toEqual({ status: 'request' });
    expect(deriveConnectRequestState(request, [], 'waiting', beforeExpiry)).toEqual({ status: 'waiting' });
    expect(deriveConnectRequestState(request, [], 'waiting', afterExpiry)).toEqual({ status: 'expired' });
    expect(deriveConnectRequestState(request, [], 'declined', afterExpiry)).toEqual({ status: 'declined' });
  });
});
