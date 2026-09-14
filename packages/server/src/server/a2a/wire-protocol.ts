import {
  MastraA2AError,
  mapV0_3TaskStateToV1,
  normalizeV1Part,
  sliceTaskHistory,
  toV1Message,
  toV1Part,
} from '@mastra/core/a2a';
import type { V1TaskState } from '@mastra/core/a2a';

export type A2AProtocolVersion = '0.3' | '1.0';

export type A2AOperation =
  | 'message/send'
  | 'message/stream'
  | 'tasks/get'
  | 'tasks/list'
  | 'tasks/cancel'
  | 'tasks/resubscribe'
  | 'tasks/pushNotificationConfig/set'
  | 'tasks/pushNotificationConfig/get'
  | 'tasks/pushNotificationConfig/list'
  | 'tasks/pushNotificationConfig/delete'
  | 'agent/getAuthenticatedExtendedCard';

export type A2AWireMethod =
  | A2AOperation
  | 'SendMessage'
  | 'SendStreamingMessage'
  | 'GetTask'
  | 'ListTasks'
  | 'CancelTask'
  | 'SubscribeToTask'
  | 'CreateTaskPushNotificationConfig'
  | 'GetTaskPushNotificationConfig'
  | 'ListTaskPushNotificationConfigs'
  | 'DeleteTaskPushNotificationConfig'
  | 'GetExtendedAgentCard';

export type A2AEncodeOptions = {
  historyLength?: number;
  includeArtifacts?: boolean;
};

/**
 * Server-side wire Adapter for one A2A protocol version.
 * Execution stays version-blind; only Adapters know 0.3 vs 1.0 shapes.
 */
export interface A2AServerCodec {
  readonly version: A2AProtocolVersion;
  readonly responseContentType: string;
  resolveOperation(method: A2AWireMethod): A2AOperation;
  decodeParams(operation: A2AOperation, params: Record<string, any> | undefined): Record<string, any> | undefined;
  encodeResponse(operation: A2AOperation, response: any, options?: A2AEncodeOptions): any;
  encodeStream(operation: A2AOperation, stream: AsyncIterable<any>, options?: A2AEncodeOptions): AsyncGenerator<any>;
  encodePushBody(task: any): unknown;
}

const V1_METHODS: Record<Exclude<A2AWireMethod, A2AOperation>, A2AOperation> = {
  SendMessage: 'message/send',
  SendStreamingMessage: 'message/stream',
  GetTask: 'tasks/get',
  ListTasks: 'tasks/list',
  CancelTask: 'tasks/cancel',
  SubscribeToTask: 'tasks/resubscribe',
  CreateTaskPushNotificationConfig: 'tasks/pushNotificationConfig/set',
  GetTaskPushNotificationConfig: 'tasks/pushNotificationConfig/get',
  ListTaskPushNotificationConfigs: 'tasks/pushNotificationConfig/list',
  DeleteTaskPushNotificationConfig: 'tasks/pushNotificationConfig/delete',
  GetExtendedAgentCard: 'agent/getAuthenticatedExtendedCard',
};

function normalizeAdvertisedVersion(version: string | undefined): A2AProtocolVersion | undefined {
  if (!version) return undefined;
  const trimmed = version.trim();
  if (trimmed === '0.3' || trimmed === '0.3.0') return '0.3';
  if (trimmed === '1.0' || trimmed === '1.0.0') return '1.0';
  return undefined;
}

export function resolveA2AProtocolVersion(request?: Request): A2AProtocolVersion {
  const raw = request?.headers.get('A2A-Version')?.trim();
  if (!raw) {
    return '0.3';
  }

  const version = normalizeAdvertisedVersion(raw);
  if (version) {
    return version;
  }

  throw MastraA2AError.versionNotSupported(raw);
}

export function resolveA2AOperation(version: A2AProtocolVersion, method: A2AWireMethod): A2AOperation {
  return getA2AServerCodec(version).resolveOperation(method);
}

export function isA2AStreamingOperation(operation: A2AOperation) {
  return operation === 'message/stream' || operation === 'tasks/resubscribe';
}

function decodeV1Params(
  operation: A2AOperation,
  params: Record<string, any> | undefined,
): Record<string, any> | undefined {
  if (!params) {
    return params;
  }

  if (operation === 'tasks/pushNotificationConfig/set') {
    return {
      taskId: params.taskId,
      pushNotificationConfig: {
        id: params.id,
        url: params.url,
        token: params.token,
        authentication: params.authentication
          ? {
              schemes: [params.authentication.scheme],
              credentials: params.authentication.credentials,
            }
          : undefined,
      },
    };
  }

  if (operation === 'tasks/pushNotificationConfig/get' || operation === 'tasks/pushNotificationConfig/delete') {
    return {
      id: params.taskId,
      pushNotificationConfigId: params.id,
    };
  }

  if (operation === 'tasks/pushNotificationConfig/list') {
    return { id: params.taskId };
  }

  if (!params.message) {
    return params;
  }

  const configuration = params.configuration;
  const taskPushNotificationConfig = configuration?.taskPushNotificationConfig;
  return {
    ...params,
    message: {
      ...params.message,
      kind: 'message',
      role: params.message.role === 'ROLE_AGENT' ? 'agent' : 'user',
      parts: params.message.parts.map((part: Record<string, unknown>) => normalizeV1Part(part)),
    },
    configuration: configuration
      ? {
          ...configuration,
          blocking: configuration.returnImmediately === undefined ? undefined : !configuration.returnImmediately,
          pushNotificationConfig: taskPushNotificationConfig
            ? {
                id: taskPushNotificationConfig.id,
                url: taskPushNotificationConfig.url,
                token: taskPushNotificationConfig.token,
                authentication: taskPushNotificationConfig.authentication
                  ? {
                      schemes: [taskPushNotificationConfig.authentication.scheme],
                      credentials: taskPushNotificationConfig.authentication.credentials,
                    }
                  : undefined,
              }
            : undefined,
        }
      : undefined,
  };
}

function toV1PushNotificationConfig(config: any) {
  return {
    taskId: config.taskId,
    id: config.pushNotificationConfig.id,
    url: config.pushNotificationConfig.url,
    token: config.pushNotificationConfig.token,
    authentication: config.pushNotificationConfig.authentication
      ? {
          scheme: config.pushNotificationConfig.authentication.schemes[0],
          credentials: config.pushNotificationConfig.authentication.credentials,
        }
      : undefined,
  };
}

export type V1Task = {
  id: any;
  contextId: any;
  status: {
    state: V1TaskState;
    message: any;
    timestamp: any;
  };
  artifacts: any[] | undefined;
  history: any[] | undefined;
  metadata: any;
};

export function toV1Task(task: any, { includeArtifacts = true, historyLength }: A2AEncodeOptions = {}): V1Task {
  return {
    id: task.id,
    contextId: task.contextId,
    status: {
      state: mapV0_3TaskStateToV1(task.status.state),
      message: toV1Message(task.status.message),
      timestamp: task.status.timestamp,
    },
    artifacts: includeArtifacts
      ? task.artifacts?.map((artifact: any) => ({
          artifactId: artifact.artifactId,
          name: artifact.name,
          description: artifact.description,
          parts: artifact.parts?.map(toV1Part),
          metadata: artifact.metadata,
          extensions: artifact.extensions,
        }))
      : undefined,
    history: sliceTaskHistory(task.history, historyLength)?.map(toV1Message),
    metadata: task.metadata,
  };
}

function toV1Result(result: any, operation: A2AOperation, options: A2AEncodeOptions = {}) {
  if (operation === 'message/send') {
    return result?.kind === 'message' ? { message: toV1Message(result) } : { task: toV1Task(result, options) };
  }
  if (operation === 'message/stream' || operation === 'tasks/resubscribe') {
    if (result?.kind === 'status-update') {
      return {
        statusUpdate: {
          taskId: result.taskId,
          contextId: result.contextId,
          status: {
            state: mapV0_3TaskStateToV1(result.status.state),
            message: toV1Message(result.status.message),
            timestamp: result.status.timestamp,
          },
          metadata: result.metadata,
        },
      };
    }
    if (result?.kind === 'artifact-update') {
      return {
        artifactUpdate: {
          taskId: result.taskId,
          contextId: result.contextId,
          artifact: {
            ...result.artifact,
            parts: result.artifact.parts?.map(toV1Part),
          },
          append: result.append,
          lastChunk: result.lastChunk,
          metadata: result.metadata,
        },
      };
    }
    return result?.kind === 'message' ? { message: toV1Message(result) } : { task: toV1Task(result, options) };
  }
  if (operation === 'tasks/get' || operation === 'tasks/cancel') {
    return toV1Task(result, options);
  }
  if (operation === 'tasks/list') {
    return {
      tasks: (result.tasks ?? []).map((task: any) => toV1Task(task, options)),
      nextPageToken: result.nextPageToken ?? '',
      pageSize: result.pageSize,
      totalSize: result.totalSize,
    };
  }
  if (operation === 'tasks/pushNotificationConfig/set' || operation === 'tasks/pushNotificationConfig/get') {
    return toV1PushNotificationConfig(result);
  }
  if (operation === 'tasks/pushNotificationConfig/list') {
    return {
      configs: result.map(toV1PushNotificationConfig),
      nextPageToken: '',
    };
  }
  return result;
}

const v0_3Codec: A2AServerCodec = {
  version: '0.3',
  responseContentType: 'application/json',
  resolveOperation(method) {
    if (method in V1_METHODS || method === 'tasks/list') {
      throw MastraA2AError.methodNotFound(method);
    }
    return method as A2AOperation;
  },
  decodeParams(_operation, params) {
    return params;
  },
  encodeResponse(_operation, response) {
    return response;
  },
  async *encodeStream(_operation, stream) {
    yield* stream;
  },
  encodePushBody(task) {
    return task;
  },
};

const v1Codec: A2AServerCodec = {
  version: '1.0',
  responseContentType: 'application/a2a+json',
  resolveOperation(method) {
    const operation = V1_METHODS[method as keyof typeof V1_METHODS];
    if (!operation) {
      throw MastraA2AError.methodNotFound(method);
    }
    return operation;
  },
  decodeParams(operation, params) {
    return decodeV1Params(operation, params);
  },
  encodeResponse(operation, response, options) {
    if (!response || !('result' in response)) {
      return response;
    }
    return { ...response, result: toV1Result(response.result, operation, options) };
  },
  async *encodeStream(operation, stream, options) {
    for await (const response of stream) {
      yield this.encodeResponse(operation, response, options);
    }
  },
  encodePushBody(task) {
    return { task: toV1Task(task) };
  },
};

export function getA2AServerCodec(version: A2AProtocolVersion): A2AServerCodec {
  return version === '1.0' ? v1Codec : v0_3Codec;
}
