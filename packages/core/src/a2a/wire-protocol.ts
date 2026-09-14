import type {
  AgentCard as AgentCardV0_3,
  Artifact as ArtifactV0_3,
  Message as MessageV0_3,
  Task as TaskV0_3,
  TaskArtifactUpdateEvent as TaskArtifactUpdateEventV0_3,
  TaskStatusUpdateEvent as TaskStatusUpdateEventV0_3,
} from '@a2a-js/sdk-v0_3';
import type { AgentCard as AgentCardV1 } from '@a2a-js/sdk-v1';
import { MastraA2AError } from './error';
import { mapV1TaskStateToV0_3, normalizeV1Message, normalizeV1Part } from './protocol-mappings';

export type A2AProtocolVersion = '0.3' | '1.0';
export type A2AProtocolSelection = 'auto' | A2AProtocolVersion;
export type A2ARemoteAgentCard = AgentCardV0_3 | AgentCardV1;

export type A2ASelectedInterface = {
  protocolVersion: A2AProtocolVersion;
  url: string;
};

export type A2ANormalizedStreamEvent = MessageV0_3 | TaskV0_3 | TaskArtifactUpdateEventV0_3 | TaskStatusUpdateEventV0_3;

function normalizeAdvertisedVersion(version: unknown): A2AProtocolVersion | undefined {
  if (version === '1.0' || version === '1.0.0') return '1.0';
  if (version === '0.3' || version === '0.3.0') return '0.3';
  return undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

export function selectA2AInterface(card: unknown, selection: A2AProtocolSelection): A2ASelectedInterface {
  if (!isRecord(card)) {
    throw MastraA2AError.invalidAgentResponse('Remote A2A agent returned a malformed agent card.');
  }

  const interfaces = Array.isArray(card.supportedInterfaces)
    ? card.supportedInterfaces.flatMap((candidate: unknown) => {
        if (!isRecord(candidate) || typeof candidate.url !== 'string') return [];
        if (candidate.protocolBinding !== 'JSONRPC') return [];
        const protocolVersion = normalizeAdvertisedVersion(candidate.protocolVersion);
        return protocolVersion ? [{ protocolVersion, url: candidate.url }] : [];
      })
    : [];

  if (typeof card.url === 'string') {
    // A2A 0.3 cards carry the execution endpoint as a top-level `url` and are NOT
    // required to self-identify a version string. Treat a top-level `url` as a 0.3
    // interface when `protocolVersion` is absent (or already normalizes to 0.3) —
    // but not when the card explicitly advertises a different version (e.g. '1.0'),
    // which would misread a v1-shaped card as 0.3. Without this, an `'auto'` default
    // silently fails against real bare-`url` 0.3 remotes (C1).
    const advertised = card.protocolVersion;
    const looksLike0_3 =
      advertised === undefined || advertised === null || normalizeAdvertisedVersion(advertised) === '0.3';
    if (looksLike0_3 && !interfaces.some(candidate => candidate.protocolVersion === '0.3')) {
      interfaces.push({ protocolVersion: '0.3', url: card.url });
    }
  }

  const selected =
    selection === 'auto' ? interfaces[0] : interfaces.find(candidate => candidate.protocolVersion === selection);

  if (!selected) {
    const advertised = [...new Set(interfaces.map(candidate => candidate.protocolVersion))];
    throw MastraA2AError.versionNotSupported(
      selection === 'auto'
        ? `no compatible JSONRPC interface (advertised: ${advertised.join(', ') || 'none'})`
        : selection,
    );
  }

  return selected;
}

export function getA2ARequestHeaders(version: A2AProtocolVersion): Record<string, string> {
  return version === '1.0'
    ? {
        'A2A-Version': '1.0',
        'content-type': 'application/a2a+json',
      }
    : {};
}

function createV0_3Message(
  prompt: string,
  data: Record<string, unknown> | undefined,
  contextId?: string,
  taskId?: string,
) {
  return {
    role: 'user',
    kind: 'message',
    messageId: crypto.randomUUID(),
    parts: [{ kind: 'text', text: prompt }, ...(data ? [{ kind: 'data', data }] : [])],
    ...(contextId ? { contextId } : {}),
    ...(taskId ? { taskId } : {}),
  };
}

function createV1Message(
  prompt: string,
  data: Record<string, unknown> | undefined,
  contextId?: string,
  taskId?: string,
) {
  return {
    role: 'ROLE_USER',
    messageId: crypto.randomUUID(),
    parts: [{ text: prompt }, ...(data ? [{ data }] : [])],
    ...(contextId ? { contextId } : {}),
    ...(taskId ? { taskId } : {}),
  };
}

export function createA2ASendMessageRequest({
  version,
  prompt,
  data,
  contextId,
  taskId,
  stream = false,
}: {
  version: A2AProtocolVersion;
  prompt: string;
  data?: Record<string, unknown>;
  contextId?: string;
  taskId?: string;
  stream?: boolean;
}) {
  return {
    jsonrpc: '2.0' as const,
    id: crypto.randomUUID(),
    method:
      version === '1.0'
        ? stream
          ? 'SendStreamingMessage'
          : 'SendMessage'
        : stream
          ? 'message/stream'
          : 'message/send',
    params: {
      message:
        version === '1.0'
          ? createV1Message(prompt, data, contextId, taskId)
          : createV0_3Message(prompt, data, contextId, taskId),
    },
  };
}

export function createA2AGetTaskRequest(version: A2AProtocolVersion, taskId: string) {
  return {
    jsonrpc: '2.0' as const,
    id: crypto.randomUUID(),
    method: version === '1.0' ? 'GetTask' : 'tasks/get',
    params: { id: taskId },
  };
}

export function createA2ASubscribeRequest(version: A2AProtocolVersion, taskId: string) {
  return {
    jsonrpc: '2.0' as const,
    id: crypto.randomUUID(),
    method: version === '1.0' ? 'SubscribeToTask' : 'tasks/resubscribe',
    params: { id: taskId },
  };
}

function normalizeV1Artifact(artifact: Record<string, any>): ArtifactV0_3 {
  return {
    artifactId: artifact.artifactId,
    name: artifact.name,
    description: artifact.description,
    parts: (artifact.parts ?? []).map((part: Record<string, unknown>) => normalizeV1Part(part)),
    metadata: artifact.metadata,
    extensions: artifact.extensions,
  };
}

function normalizeV1State(state: unknown): TaskV0_3['status']['state'] {
  return mapV1TaskStateToV0_3(state) as TaskV0_3['status']['state'];
}

function normalizeV1Task(task: Record<string, any>): TaskV0_3 {
  return {
    kind: 'task',
    id: task.id,
    contextId: task.contextId,
    status: {
      state: normalizeV1State(task.status?.state),
      message: task.status?.message ? (normalizeV1Message(task.status.message) as MessageV0_3) : undefined,
      timestamp: task.status?.timestamp,
    },
    artifacts: task.artifacts?.map(normalizeV1Artifact),
    history: task.history?.map((message: Record<string, any>) => normalizeV1Message(message) as MessageV0_3),
    metadata: task.metadata,
  };
}

export function decodeA2AResult(version: A2AProtocolVersion, result: unknown): MessageV0_3 | TaskV0_3 {
  if (version === '0.3') {
    return result as MessageV0_3 | TaskV0_3;
  }
  if (!isRecord(result)) {
    throw MastraA2AError.invalidAgentResponse('Remote A2A v1 agent returned a malformed result.');
  }
  if (isRecord(result.task)) return normalizeV1Task(result.task);
  if (isRecord(result.message)) return normalizeV1Message(result.message) as MessageV0_3;
  if ('status' in result && 'id' in result) return normalizeV1Task(result);
  throw MastraA2AError.invalidAgentResponse('Remote A2A v1 agent returned neither a task nor a message.');
}

export function decodeA2AStreamEvent(version: A2AProtocolVersion, event: unknown): A2ANormalizedStreamEvent {
  if (version === '0.3') {
    return event as A2ANormalizedStreamEvent;
  }
  if (!isRecord(event)) {
    throw MastraA2AError.invalidAgentResponse('Remote A2A v1 agent returned a malformed stream event.');
  }
  if (isRecord(event.task)) return normalizeV1Task(event.task);
  if (isRecord(event.message)) return normalizeV1Message(event.message) as MessageV0_3;
  if (isRecord(event.statusUpdate)) {
    return {
      kind: 'status-update',
      taskId: event.statusUpdate.taskId,
      contextId: event.statusUpdate.contextId,
      status: {
        state: normalizeV1State(event.statusUpdate.status?.state),
        message: event.statusUpdate.status?.message
          ? (normalizeV1Message(event.statusUpdate.status.message) as MessageV0_3)
          : undefined,
        timestamp: event.statusUpdate.status?.timestamp,
      },
      final: false,
      metadata: event.statusUpdate.metadata,
    };
  }
  if (isRecord(event.artifactUpdate)) {
    return {
      kind: 'artifact-update',
      taskId: event.artifactUpdate.taskId,
      contextId: event.artifactUpdate.contextId,
      artifact: normalizeV1Artifact(event.artifactUpdate.artifact),
      append: event.artifactUpdate.append,
      lastChunk: event.artifactUpdate.lastChunk,
      metadata: event.artifactUpdate.metadata,
    };
  }
  throw MastraA2AError.invalidAgentResponse('Remote A2A v1 agent returned an unknown stream event.');
}
