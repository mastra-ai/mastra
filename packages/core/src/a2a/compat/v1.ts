import { randomUUID } from 'node:crypto';
import type { AgentCard, Message, Task } from '@a2a-js/sdk-v0_3';
import {
  AgentCard as AgentCardCodec,
  GetTaskRequest as GetTaskRequestCodec,
  Role,
  SendMessageRequest as SendMessageRequestCodec,
  SendMessageResponse as SendMessageResponseCodec,
  StreamResponse as StreamResponseCodec,
  SubscribeToTaskRequest as SubscribeToTaskRequestCodec,
  Task as TaskCodec,
  TaskState,
} from '@a2a-js/sdk-v1';
import type {
  AgentCard as AgentCardV1,
  Artifact,
  Message as MessageV1,
  Part,
  SendMessageResponse,
  StreamResponse,
  Task as TaskV1,
  TaskStatus,
} from '@a2a-js/sdk-v1';
import { MastraA2AError } from '../error';
import type { A2AProtocolCompat, A2AStreamEventData, SendMessageInput } from './types';

function fromPart(part: Part): Message['parts'][number] {
  const metadata = part.metadata ?? undefined;
  switch (part.content?.$case) {
    case 'text':
      return { kind: 'text', text: part.content.value, metadata };
    case 'raw':
      return {
        kind: 'file',
        file: {
          bytes: Buffer.from(part.content.value).toString('base64'),
          mimeType: part.mediaType,
          name: part.filename,
        },
        metadata,
      };
    case 'url':
      return {
        kind: 'file',
        file: { uri: part.content.value, mimeType: part.mediaType, name: part.filename },
        metadata,
      };
    case 'data':
      return { kind: 'data', data: part.content.value, metadata };
    default:
      return { kind: 'data', data: {}, metadata };
  }
}

function fromMessage(message: MessageV1): Message {
  return {
    kind: 'message',
    messageId: message.messageId,
    role: message.role === Role.ROLE_AGENT ? 'agent' : 'user',
    parts: message.parts.map(fromPart),
    ...(message.contextId ? { contextId: message.contextId } : {}),
    ...(message.taskId ? { taskId: message.taskId } : {}),
    ...(message.metadata ? { metadata: message.metadata } : {}),
    ...(message.extensions.length ? { extensions: message.extensions } : {}),
    ...(message.referenceTaskIds.length ? { referenceTaskIds: message.referenceTaskIds } : {}),
  };
}

function fromTaskState(state: TaskState): Task['status']['state'] {
  switch (state) {
    case TaskState.TASK_STATE_SUBMITTED:
      return 'submitted';
    case TaskState.TASK_STATE_WORKING:
      return 'working';
    case TaskState.TASK_STATE_COMPLETED:
      return 'completed';
    case TaskState.TASK_STATE_FAILED:
      return 'failed';
    case TaskState.TASK_STATE_CANCELED:
      return 'canceled';
    case TaskState.TASK_STATE_INPUT_REQUIRED:
      return 'input-required';
    case TaskState.TASK_STATE_REJECTED:
      return 'rejected';
    case TaskState.TASK_STATE_AUTH_REQUIRED:
      return 'auth-required';
    default:
      return 'unknown';
  }
}

function fromStatus(status: TaskStatus | undefined): Task['status'] {
  return {
    state: fromTaskState(status?.state ?? TaskState.TASK_STATE_UNSPECIFIED),
    ...(status?.message ? { message: fromMessage(status.message) } : {}),
    ...(status?.timestamp ? { timestamp: status.timestamp } : {}),
  };
}

function fromArtifact(artifact: Artifact): NonNullable<Task['artifacts']>[number] {
  return {
    artifactId: artifact.artifactId,
    name: artifact.name,
    description: artifact.description,
    parts: artifact.parts.map(fromPart),
    ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
    ...(artifact.extensions.length ? { extensions: artifact.extensions } : {}),
  };
}

function fromTask(task: TaskV1): Task {
  return {
    kind: 'task',
    id: task.id,
    contextId: task.contextId,
    status: fromStatus(task.status),
    artifacts: task.artifacts.map(fromArtifact),
    history: task.history.map(fromMessage),
    ...(task.metadata ? { metadata: task.metadata } : {}),
  };
}

function fromSendMessageResponse(response: SendMessageResponse): Message | Task {
  const payload = response.payload;
  if (!payload) {
    throw MastraA2AError.invalidAgentResponse('Remote A2A v1.0 agent returned an empty message response.');
  }
  return payload.$case === 'task' ? fromTask(payload.value) : fromMessage(payload.value);
}

function fromStreamResponse(response: StreamResponse): A2AStreamEventData {
  const payload = response.payload;
  if (!payload) {
    throw MastraA2AError.invalidAgentResponse('Remote A2A v1.0 agent returned an empty stream payload.');
  }

  switch (payload.$case) {
    case 'task':
      return fromTask(payload.value);
    case 'message':
      return fromMessage(payload.value);
    case 'statusUpdate':
      return {
        kind: 'status-update',
        taskId: payload.value.taskId,
        contextId: payload.value.contextId,
        status: fromStatus(payload.value.status),
        final: false,
        ...(payload.value.metadata ? { metadata: payload.value.metadata } : {}),
      };
    case 'artifactUpdate':
      if (!payload.value.artifact) {
        throw MastraA2AError.invalidAgentResponse(
          'Remote A2A v1.0 agent returned an artifact update without an artifact.',
        );
      }
      return {
        kind: 'artifact-update',
        taskId: payload.value.taskId,
        contextId: payload.value.contextId,
        artifact: fromArtifact(payload.value.artifact),
        append: payload.value.append,
        lastChunk: payload.value.lastChunk,
        ...(payload.value.metadata ? { metadata: payload.value.metadata } : {}),
      };
  }
}

function createSendMessageParams({ prompt, data, contextId, taskId }: SendMessageInput): Record<string, unknown> {
  const request = SendMessageRequestCodec.fromJSON({
    message: {
      role: 'ROLE_USER',
      messageId: randomUUID(),
      parts: [{ text: prompt }, ...(data ? [{ data }] : [])],
      ...(contextId ? { contextId } : {}),
      ...(taskId ? { taskId } : {}),
    },
  });
  return SendMessageRequestCodec.toJSON(request) as Record<string, unknown>;
}

function fromAgentCard(card: AgentCardV1): AgentCard {
  const jsonRpcInterface = card.supportedInterfaces.find(
    agentInterface =>
      agentInterface.protocolBinding.toUpperCase() === 'JSONRPC' && agentInterface.protocolVersion === '1.0',
  );
  if (!jsonRpcInterface) {
    throw MastraA2AError.invalidAgentResponse('Remote A2A v1.0 agent card does not advertise a JSON-RPC interface.');
  }

  return {
    name: card.name,
    description: card.description,
    url: jsonRpcInterface.url,
    preferredTransport: 'JSONRPC',
    protocolVersion: jsonRpcInterface.protocolVersion,
    version: card.version,
    capabilities: card.capabilities as AgentCard['capabilities'],
    defaultInputModes: card.defaultInputModes,
    defaultOutputModes: card.defaultOutputModes,
    skills: card.skills as AgentCard['skills'],
    ...(card.provider ? { provider: card.provider } : {}),
    ...(card.documentationUrl ? { documentationUrl: card.documentationUrl } : {}),
  };
}

export const v1Compat: A2AProtocolCompat = {
  headers: { 'A2A-Version': '1.0' },
  methods: {
    sendMessage: 'SendMessage',
    streamMessage: 'SendStreamingMessage',
    getTask: 'GetTask',
    resubscribeTask: 'SubscribeToTask',
  },
  decodeAgentCard: value => fromAgentCard(AgentCardCodec.fromJSON(value)),
  createSendMessageParams,
  decodeSendMessageResult: value => fromSendMessageResponse(SendMessageResponseCodec.fromJSON(value)),
  createGetTaskParams: taskId =>
    GetTaskRequestCodec.toJSON(GetTaskRequestCodec.fromJSON({ id: taskId })) as Record<string, unknown>,
  decodeGetTaskResult: value => fromTask(TaskCodec.fromJSON(value)),
  createResubscribeParams: taskId =>
    SubscribeToTaskRequestCodec.toJSON(SubscribeToTaskRequestCodec.fromJSON({ id: taskId })) as Record<string, unknown>,
  decodeStreamResult: value => fromStreamResponse(StreamResponseCodec.fromJSON(value)),
};
