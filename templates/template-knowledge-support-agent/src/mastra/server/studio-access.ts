import type { ApiRoute } from '@mastra/core/server';
import { findMatchingCustomRoute } from '@mastra/server/auth';
import {
  GENERATE_AGENT_ROUTE,
  GET_AGENT_BY_ID_ROUTE,
  LIST_AGENTS_ROUTE,
  STREAM_GENERATE_ROUTE,
} from '@mastra/server/handlers/agents';
import {
  GET_KNOWLEDGE_ACTIVITY_ROUTE,
  GET_KNOWLEDGE_GRAPH_ROUTE,
  GET_KNOWLEDGE_LINK_COUNTS_ROUTE,
  GET_KNOWLEDGE_PAGE_LINKS_ROUTE,
  GET_KNOWLEDGE_PAGE_ROUTE,
  GET_KNOWLEDGE_TREE_ROUTE,
  LIST_KNOWLEDGE_ROUTE,
  SEARCH_KNOWLEDGE_ROUTE,
} from '@mastra/server/handlers/knowledge';
import {
  CREATE_THREAD_ROUTE,
  GET_MEMORY_CONFIG_ROUTE,
  GET_MEMORY_STATUS_ROUTE,
  GET_THREAD_BY_ID_ROUTE,
  LIST_MESSAGES_ROUTE,
  LIST_THREADS_ROUTE,
} from '@mastra/server/handlers/memory';
import { GET_SYSTEM_PACKAGES_ROUTE } from '@mastra/server/handlers/system';
import { LIST_TOOLS_ROUTE } from '@mastra/server/handlers/tools';
import type { Memory } from '@mastra/memory';

type RoutePolicy = (input: {
  request: Request;
  owner: string;
  params: Record<string, string>;
}) => boolean | Promise<boolean>;

const agentFields = ['messages', 'memory'];
const streamFields = [
  ...agentFields,
  'runId',
  'maxSteps',
  'untilIdle',
  'modelSettings',
  'requestContext',
  'tracingOptions',
];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const threadIdPattern = /^[a-zA-Z0-9_-]{1,100}$/u;

function onlyKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key))
  );
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.clone().json();
  } catch {
    return undefined;
  }
}

function isUserMessage(message: unknown): boolean {
  return (
    onlyKeys(message, ['role', 'content']) &&
    message.role === 'user' &&
    (typeof message.content === 'string' ||
      (Array.isArray(message.content) &&
        message.content.every(
          part => onlyKeys(part, ['type', 'text']) && part.type === 'text' && typeof part.text === 'string',
        )))
  );
}

function hasStudioStreamOptions(body: Record<string, unknown>): boolean {
  const { runId, maxSteps, untilIdle, modelSettings, requestContext, tracingOptions } = body;
  return (
    (runId === undefined || (typeof runId === 'string' && uuidPattern.test(runId))) &&
    (maxSteps === undefined || maxSteps === 15) &&
    (untilIdle === undefined || untilIdle === true) &&
    (modelSettings === undefined || (onlyKeys(modelSettings, ['maxRetries']) && modelSettings.maxRetries === 2)) &&
    [requestContext, tracingOptions].every(value => value === undefined || onlyKeys(value, []))
  );
}

const supportAgent = ({ params }: Parameters<RoutePolicy>[0]) => params.agentId === 'support';
const supportKnowledge = ({ params }: Parameters<RoutePolicy>[0]) => params.knowledgeKey === 'support';

export function createStudioAccess(memory: Memory) {
  let pending: Promise<unknown> = Promise.resolve();

  function bindThread(threadId: string, owner: string): Promise<boolean> {
    const operation = pending.then(async () => {
      const thread = await memory.getThreadById({ threadId });
      if (thread) return thread.resourceId === owner;
      await memory.createThread({ threadId, resourceId: owner });
      return true;
    });
    pending = operation.catch(() => undefined);
    return operation;
  }

  const readThread: RoutePolicy = async ({ params, owner }) => {
    const thread = await memory.getThreadById({ threadId: params.threadId! });
    return thread?.resourceId === owner;
  };

  const createThread: RoutePolicy = async ({ request, owner }) => {
    const body = await readBody(request);
    // The native create route allocates the ID. Studio draft IDs bind through agent execution.
    return (
      onlyKeys(body, ['title', 'resourceId']) &&
      (body.resourceId === undefined || body.resourceId === owner) &&
      (body.title === undefined || typeof body.title === 'string') &&
      new URL(request.url).searchParams.get('agentId') === 'support'
    );
  };

  const runAgent =
    (stream: boolean): RoutePolicy =>
    async input => {
      if (!supportAgent(input)) return false;

      const { request, owner } = input;
      const body = await readBody(request);
      if (
        !onlyKeys(body, stream ? streamFields : agentFields) ||
        (stream && !hasStudioStreamOptions(body)) ||
        !Array.isArray(body.messages) ||
        !body.messages.length ||
        !body.messages.every(isUserMessage) ||
        !onlyKeys(body.memory, ['thread', 'resource'])
      ) {
        return false;
      }

      const { thread, resource } = body.memory;
      return (
        typeof thread === 'string' &&
        threadIdPattern.test(thread) &&
        (resource === undefined || resource === owner || (stream && resource === 'support')) &&
        bindThread(thread, owner)
      );
    };

  const policies = new Map<ApiRoute, RoutePolicy>([
    ...[
      LIST_AGENTS_ROUTE,
      LIST_KNOWLEDGE_ROUTE,
      LIST_TOOLS_ROUTE,
      GET_MEMORY_CONFIG_ROUTE,
      GET_MEMORY_STATUS_ROUTE,
      GET_SYSTEM_PACKAGES_ROUTE,
    ].map(route => [route, () => true] as const),
    ...[
      GET_KNOWLEDGE_ACTIVITY_ROUTE,
      GET_KNOWLEDGE_GRAPH_ROUTE,
      GET_KNOWLEDGE_LINK_COUNTS_ROUTE,
      GET_KNOWLEDGE_PAGE_LINKS_ROUTE,
      GET_KNOWLEDGE_PAGE_ROUTE,
      GET_KNOWLEDGE_TREE_ROUTE,
      SEARCH_KNOWLEDGE_ROUTE,
    ].map(route => [route, supportKnowledge] as const),
    [GET_AGENT_BY_ID_ROUTE, supportAgent],
    [
      LIST_THREADS_ROUTE,
      ({ request }) => {
        const agentId = new URL(request.url).searchParams.get('agentId');
        return !agentId || agentId === 'support';
      },
    ],
    [GET_THREAD_BY_ID_ROUTE, readThread],
    [LIST_MESSAGES_ROUTE, readThread],
    [CREATE_THREAD_ROUTE, createThread],
    [GENERATE_AGENT_ROUTE, runAgent(false)],
    [STREAM_GENERATE_ROUTE, runAgent(true)],
  ]);
  const routes = [...policies.keys()];

  return (path: string, method: string, request: Request, owner: string): boolean | Promise<boolean> => {
    if (method !== 'GET' && method !== 'POST') return false;

    const match = findMatchingCustomRoute(path.startsWith('/api/') ? path.slice(4) : path, method, routes);
    return match ? (policies.get(match.route)?.({ request, owner, params: match.params }) ?? false) : false;
  };
}
