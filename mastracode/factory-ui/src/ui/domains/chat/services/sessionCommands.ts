import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../../api/keys';
import {
  CUSTOM_COMMAND_NAME_RE,
  MAX_COMMAND_LENGTH,
  SKILL_COMMAND_NAME_RE,
  isSessionCommandToken,
  sessionCommandsRoute,
} from '@mastra/factory/routes/session-command-contract';
import type {
  SessionCommandDescriptor,
  SessionCommandDiscoveryResponse,
  SessionCommandPrepareRequest,
  SessionCommandPrepareResponse,
} from '@mastra/factory/routes/session-command-contract';

/**
 * Browser transport for Factory session-command discovery/preparation. Only
 * the dependency-free protocol leaf is imported from `@mastra/factory` — never
 * server code. Every response is decoded before React sees it.
 */

export class SessionCommandProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionCommandProtocolError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function expectString(value: unknown): string {
  if (typeof value !== 'string') throw new SessionCommandProtocolError('Malformed command payload');
  return value;
}

function decodeDescriptor(value: unknown): SessionCommandDescriptor {
  if (!isRecord(value)) throw new SessionCommandProtocolError('Malformed command descriptor');
  const command = expectString(value.command);
  const source = value.source;
  const name = expectString(value.name);
  const description = expectString(value.description);
  if (typeof value.goal !== 'boolean') throw new SessionCommandProtocolError('Malformed command descriptor');
  if (command.length === 0 || command.length > MAX_COMMAND_LENGTH || !isSessionCommandToken(command)) {
    throw new SessionCommandProtocolError('Malformed command token');
  }
  if ((source !== 'custom' && source !== 'skill') || name.length === 0) {
    throw new SessionCommandProtocolError('Malformed command descriptor');
  }
  if (source === 'custom' ? !CUSTOM_COMMAND_NAME_RE.test(name) : !SKILL_COMMAND_NAME_RE.test(name)) {
    throw new SessionCommandProtocolError('Malformed command name');
  }
  return { command, source, name, description, goal: value.goal };
}

export function decodeDiscovery(payload: unknown): SessionCommandDiscoveryResponse {
  if (!isRecord(payload) || !isRecord(payload.capabilities)) {
    throw new SessionCommandProtocolError('Malformed discovery response');
  }
  const { customCommands, skills } = payload.capabilities;
  if (
    (customCommands !== 'supported' && customCommands !== 'unsupported') ||
    (skills !== 'supported' && skills !== 'unsupported')
  ) {
    throw new SessionCommandProtocolError('Malformed capability flags');
  }
  if (!Array.isArray(payload.commands)) throw new SessionCommandProtocolError('Malformed command list');
  return {
    capabilities: { customCommands, skills },
    commands: payload.commands.map(decodeDescriptor),
  };
}

export function decodePrepareOutcome(payload: unknown): SessionCommandPrepareResponse {
  if (!isRecord(payload)) throw new SessionCommandProtocolError('Malformed preparation response');
  if (payload.action === 'message') {
    const content = expectString(payload.content);
    if (!content.trim()) throw new SessionCommandProtocolError('Empty message envelope');
    return { action: 'message', content };
  }
  if (payload.action === 'goal') {
    const objective = expectString(payload.objective);
    if (!objective.trim()) throw new SessionCommandProtocolError('Empty goal objective');
    return { action: 'goal', objective };
  }
  if (payload.action === 'none') {
    return { action: 'none', notice: expectString(payload.notice) };
  }
  throw new SessionCommandProtocolError('Unknown preparation outcome');
}

async function postJson<TSuccess>(
  url: string,
  body: unknown,
  decode: (payload: unknown) => TSuccess,
): Promise<TSuccess> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let payloadText: string | undefined;
  try {
    payloadText = await response.text();
  } catch {
    // Intermediaries may close the stream; handled below as an invalid body.
  }
  let payload: unknown;
  if (payloadText !== undefined && payloadText.length > 0) {
    try {
      payload = JSON.parse(payloadText);
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    let detail = 'The request failed.';
    if (isRecord(payload) && typeof payload.message === 'string') detail = payload.message;
    throw new SessionCommandProtocolError(detail);
  }
  return decode(payload);
}

export interface SessionCommandAddress {
  agentControllerId: string;
  resourceId: string;
  projectRepositoryId?: string;
  scope?: string;
  /** Same-origin by default; tests inject an absolute origin. */
  baseUrl?: string;
}

function addressPayload(address: SessionCommandAddress) {
  return {
    resourceId: address.resourceId,
    ...(address.projectRepositoryId ? { projectRepositoryId: address.projectRepositoryId } : {}),
    ...(address.scope ? { scope: address.scope } : {}),
  };
}

export async function discoverSessionCommandsViaFetch(
  address: SessionCommandAddress,
): Promise<SessionCommandDiscoveryResponse> {
  return postJson(
    `${address.baseUrl ?? ''}${sessionCommandsRoute(encodeURIComponent(address.agentControllerId), 'discover')}`,
    addressPayload(address),
    decodeDiscovery,
  );
}

export async function prepareSessionCommandViaFetch(
  address: SessionCommandAddress,
  request: Pick<SessionCommandPrepareRequest, 'command' | 'arguments'>,
): Promise<SessionCommandPrepareResponse> {
  return postJson(
    `${address.baseUrl ?? ''}${sessionCommandsRoute(encodeURIComponent(address.agentControllerId), 'prepare')}`,
    {
      ...addressPayload(address),
      command: request.command,
      ...(request.arguments !== undefined ? { arguments: request.arguments } : {}),
    },
    decodePrepareOutcome,
  );
}

export type UseSessionCommandsArgs = SessionCommandAddress;

/** Discovery is driven manually (`enabled: false`) so the composer controls refetch timing. */
export function useSessionCommandsQuery({
  agentControllerId,
  resourceId,
  projectRepositoryId,
  scope,
  baseUrl,
}: UseSessionCommandsArgs) {
  return useQuery({
    queryKey: queryKeys.sessionCommands(agentControllerId, resourceId, projectRepositoryId, scope),
    enabled: false,
    queryFn: () =>
      discoverSessionCommandsViaFetch({ agentControllerId, resourceId, projectRepositoryId, scope, baseUrl }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
