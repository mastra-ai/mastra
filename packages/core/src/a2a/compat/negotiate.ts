import type { AgentCard } from '@a2a-js/sdk-v0_3';
import { AgentCard as AgentCardCodec } from '@a2a-js/sdk-v1';
import { MastraA2AError } from '../error';
import type { A2AProtocolCompat } from './types';
import { v0_3Compat } from './v0_3';
import { fromAgentCard, v1Compat } from './v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isExecutionUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function negotiateAgentCard(value: unknown): { card: AgentCard; compat: A2AProtocolCompat } {
  if (!isRecord(value)) {
    throw MastraA2AError.invalidAgentResponse('Remote A2A agent card must be an object.');
  }

  if (!('supportedInterfaces' in value)) {
    if (!isExecutionUrl(value.url)) {
      throw MastraA2AError.invalidAgentResponse(
        'Remote legacy A2A agent card must advertise an HTTP(S) execution URL.',
      );
    }
    return { card: v0_3Compat.decodeAgentCard(value), compat: v0_3Compat };
  }

  if (Array.isArray(value.supportedInterfaces)) {
    for (const protocolVersion of ['1.0', '0.3']) {
      const selectedInterface = value.supportedInterfaces.find(
        (candidate: unknown): candidate is { url: string; protocolVersion: string; protocolBinding: string } =>
          isRecord(candidate) &&
          typeof candidate.protocolBinding === 'string' &&
          candidate.protocolBinding.toUpperCase() === 'JSONRPC' &&
          candidate.protocolVersion === protocolVersion &&
          isExecutionUrl(candidate.url),
      );
      if (selectedInterface) {
        const card = AgentCardCodec.fromJSON({ ...value, supportedInterfaces: [selectedInterface] });
        return {
          card: fromAgentCard(card, selectedInterface),
          compat: protocolVersion === '1.0' ? v1Compat : v0_3Compat,
        };
      }
    }
  }

  throw MastraA2AError.invalidAgentResponse(
    'Remote A2A agent card must advertise a JSONRPC interface for protocol version 1.0 or 0.3 with an HTTP(S) execution URL.',
  );
}
