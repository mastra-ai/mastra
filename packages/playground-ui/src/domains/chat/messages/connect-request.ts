import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { isRecord } from './signal-data';
import type { ConnectionRequestStatus } from '@/ds/components/ai/connection-request/connection-request-card';

export const CONNECT_REQUEST_PART_TYPE = 'data-mastra-connect-request';

export type ConnectRequestData = {
  requestId: string;
  integration: string;
  displayName: string;
  logoUrl?: string;
  reason: string;
  connectionId: string;
  connectUrl: string;
  expiresAt: string;
  agentId: string;
  threadId: string;
  resourceId: string;
  trace?: { traceId: string; spanId: string };
};

export type LocalConnectRequestState = 'waiting' | 'declined';

export type ConnectRequestCardState = { status: ConnectionRequestStatus; accountLabel?: string };

const requiredFields = [
  'requestId',
  'integration',
  'displayName',
  'reason',
  'connectionId',
  'connectUrl',
  'expiresAt',
  'agentId',
  'threadId',
  'resourceId',
] as const;

export const isConnectRequestData = (value: unknown): value is ConnectRequestData =>
  isRecord(value) && requiredFields.every(field => typeof value[field] === 'string');

const outcomeStatuses = new Set<unknown>(['connected', 'failed', 'declined']);

const signalAttributes = (message: MastraDBMessage): unknown[] => [
  isRecord(message.content.metadata?.signal) ? message.content.metadata.signal.attributes : undefined,
  ...message.content.parts.map(part =>
    part.type === 'data-signal' && isRecord(part.data) ? part.data.attributes : undefined,
  ),
];

export const deriveConnectRequestState = (
  request: ConnectRequestData,
  messages: MastraDBMessage[],
  local: LocalConnectRequestState | undefined,
  now: number,
): ConnectRequestCardState => {
  const outcome = messages
    .flatMap(signalAttributes)
    .filter(isRecord)
    .findLast(
      attributes => attributes.connectRequestId === request.requestId && outcomeStatuses.has(attributes.outcome),
    );

  if (outcome?.outcome === 'connected') {
    return {
      status: 'connected',
      accountLabel: typeof outcome.accountLabel === 'string' ? outcome.accountLabel : undefined,
    };
  }
  if (outcome?.outcome === 'failed' || outcome?.outcome === 'declined') return { status: outcome.outcome };
  if (local === 'declined') return { status: 'declined' };
  if (Date.parse(request.expiresAt) <= now) return { status: 'expired' };
  return { status: local ?? 'request' };
};
