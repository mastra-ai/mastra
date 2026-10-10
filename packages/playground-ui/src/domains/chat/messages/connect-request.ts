import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { z } from 'zod';
import { isRecord } from './signal-data';
import type { ConnectionRequestStatus } from '@/ds/components/ai/connection-request/connection-request-card';

export const CONNECT_REQUEST_PART_TYPE = 'data-mastra-connect-request';

const connectRequestSchema = z.object({
  requestId: z.string(),
  integration: z.string(),
  displayName: z.string(),
  logoUrl: z.string().optional(),
  reason: z.string(),
  connectionId: z.string(),
  connectUrl: z.string(),
  expiresAt: z.string(),
  agentId: z.string(),
  threadId: z.string(),
  resourceId: z.string(),
  trace: z.object({ traceId: z.string(), spanId: z.string() }).optional(),
});

export type ConnectRequestData = z.infer<typeof connectRequestSchema>;

export type LocalConnectRequestState = 'waiting' | 'declined';

export type ConnectRequestCardState = { status: ConnectionRequestStatus; accountLabel?: string };

export const isConnectRequestData = (value: unknown): value is ConnectRequestData =>
  connectRequestSchema.safeParse(value).success;

const outcomeSchema = z.object({
  connectRequestId: z.string(),
  outcome: z.enum(['connected', 'failed', 'declined']),
  accountLabel: z.string().optional(),
});

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
    .flatMap(attributes => {
      const parsed = outcomeSchema.safeParse(attributes);
      return parsed.success && parsed.data.connectRequestId === request.requestId ? [parsed.data] : [];
    })
    .at(-1);

  if (outcome?.outcome === 'connected') return { status: 'connected', accountLabel: outcome.accountLabel };
  if (outcome?.outcome === 'failed' || outcome?.outcome === 'declined') return { status: outcome.outcome };
  if (local === 'declined') return { status: 'declined' };
  if (Date.parse(request.expiresAt) <= now) return { status: 'expired' };
  return { status: local ?? 'request' };
};
