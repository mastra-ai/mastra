import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { BillingError, identifierSchema } from '../billing/contracts/core.js';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { ConversationStorage } from '../billing/storage/conversations.js';
import type { StudioAgentRuntime } from './studio-agent-decorator.js';

const text = z.string().min(1).max(8192);
const textContents = z.union([
  text,
  z
    .array(z.strictObject({ type: z.literal('text'), text }))
    .min(1)
    .max(16),
]);
const message = z.union([
  textContents,
  z.strictObject({
    contents: textContents,
    metadata: z.strictObject({ clientMessageId: identifierSchema }).optional(),
  }),
]);
const emptyContext = z.union([z.strictObject({}), z.strictObject({ requestContext: z.strictObject({}) })]);
const conversationModelSettings = z.strictObject({ maxRetries: z.number().int().min(0).max(2).optional() });
// Only a router identifier crosses the browser boundary. Connection details stay server-owned.
const conversationModel = z
  .string()
  .max(512)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*(?:\/[a-zA-Z0-9@~][a-zA-Z0-9._:@+~-]*)+$/);
const conversationStreamOptions = z.strictObject({
  model: conversationModel.optional(),
  maxSteps: z.number().int().min(1).max(32).optional(),
  modelSettings: conversationModelSettings.optional(),
  // Studio echoes the server's tool-compatible model default. Other provider overrides stay closed.
  providerOptions: z.strictObject({ openai: z.strictObject({ reasoningEffort: z.literal('none') }) }).optional(),
  tracingOptions: z.strictObject({}).optional(),
  requestContext: z.strictObject({}).optional(),
});
const userSignal = z.strictObject({ type: z.literal('user'), contents: textContents, id: identifierSchema.optional() });
const forbiddenKeys = new Set([
  'actor',
  'actorId',
  'workspaceId',
  'accountId',
  'credential',
  'authorization',
  'tools',
  'toolsets',
  'clientTools',
  'model',
  'versions',
  'version',
  'versionId',
  'editor',
  'editorId',
  'memory',
  'scopes',
  'resource',
  'thread',
  'instructions',
  'system',
  'toolChoice',
  'activeTools',
  'requireToolApproval',
  'autoResumeSuspendedTools',
  'agentVersion',
  'versionStatus',
  'editorAgentId',
]);
function validateOptions(value: unknown, modelOptions: readonly unknown[], depth = 0): void {
  if (!value || typeof value !== 'object') return;
  if (depth > 12) throw new BillingError('invalid_input');
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'model' && modelOptions.includes(value)) {
      if (!conversationModel.safeParse(entry).success) throw new BillingError('forbidden');
      continue;
    }
    if (
      (key === 'modelSettings' && !conversationModelSettings.safeParse(entry).success) ||
      forbiddenKeys.has(key) ||
      (key === 'requestContext' && entry && Object.keys(entry).length)
    )
      throw new BillingError('forbidden');
    // Text message/tool input content is data, not execution options.
    if (!['message', 'messages', 'signal', 'resumeData'].includes(key)) validateOptions(entry, modelOptions, depth + 1);
  }
}
export const studioChatFailure = (context: Context, error: unknown) => {
  const failure = error instanceof BillingError ? error : new BillingError('invalid_input');
  return context.json(
    { error: { code: failure.code } },
    failure.code === 'unauthenticated'
      ? 401
      : failure.code === 'forbidden'
        ? 403
        : failure.code === 'conflict'
          ? 409
          : 400,
  );
};
/** Inspect native execution options, never the user's messages or tool input data. */
function memoryReferences(
  value: unknown,
  references: { threads: Set<string>; resources: Set<string>; runs: Set<string>; messages: Set<string> },
  depth = 0,
) {
  if (!value || typeof value !== 'object') return;
  if (depth > 16) throw new BillingError('invalid_input');
  for (const [key, entry] of Object.entries(value)) {
    const target = ['thread', 'threadId', 'mastra__threadId'].includes(key)
      ? references.threads
      : ['resource', 'resourceId', 'mastra__resourceId'].includes(key)
        ? references.resources
        : ['runId', 'expectedRunId'].includes(key)
          ? references.runs
          : undefined;
    if (target && typeof entry === 'string') target.add(entry);
    if (key === 'thread' && entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'string')
      references.threads.add(entry.id);
    // Native message identities can upsert shared storage; inspect identity fields, not their content.
    if (['message', 'messages', 'signal', 'context'].includes(key)) {
      for (const message of Array.isArray(entry) ? entry : [entry]) {
        if (!message || typeof message !== 'object') continue;
        if (typeof message.id === 'string') references.messages.add(message.id);
        if (typeof message.threadId === 'string') references.threads.add(message.threadId);
        if (typeof message.resourceId === 'string') references.resources.add(message.resourceId);
        if (message.metadata && typeof message.metadata === 'object') {
          if (typeof message.metadata.threadId === 'string') references.threads.add(message.metadata.threadId);
          if (typeof message.metadata.resourceId === 'string') references.resources.add(message.metadata.resourceId);
        }
      }
    }
    if (key === 'scopes' && Array.isArray(entry)) {
      for (const scope of entry) {
        if (scope && typeof scope.id === 'string') {
          if (scope.type === 'thread') references.threads.add(scope.id);
          if (scope.type === 'resource') references.resources.add(scope.id);
        }
      }
    }
    if (references.threads.size + references.resources.size + references.runs.size + references.messages.size > 128)
      throw new BillingError('invalid_input');
    if (!['message', 'messages', 'signal', 'resumeData', 'data', 'context', 'metadata'].includes(key))
      memoryReferences(entry, references, depth + 1);
  }
}
export async function protectConversationMemory(
  context: Context,
  conversations: ConversationStorage,
  storage: MastraCompositeStore,
  path: string,
) {
  const references = {
    threads: new Set<string>(),
    resources: new Set<string>(),
    runs: new Set<string>(),
    messages: new Set<string>(),
  };
  for (const match of path.matchAll(/\/(threads|runs)\/([^/]+)/g)) {
    if (!['subscribe', 'abort', 'signals'].includes(match[2]))
      (match[1] === 'threads' ? references.threads : references.runs).add(decodeURIComponent(match[2]));
  }
  memoryReferences(
    { threadId: context.req.header('x-thread-id'), resourceId: context.req.header('x-resource-id') },
    references,
  );
  for (const [key, value] of new URL(context.req.url).searchParams) {
    memoryReferences({ [key]: value }, references);
    if (['requestContext', 'memory', 'streamOptions', 'filter'].includes(key)) {
      if (value.length > 32768) throw new BillingError('invalid_input');
      const decoded = value.trimStart().startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8');
      memoryReferences(JSON.parse(decoded), references);
    }
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(context.req.method)) {
    // Clone: the installed native adapter must consume its original body and all options.
    const body = await context.req.raw.clone().text();
    if (body) memoryReferences(JSON.parse(body), references);
  }
  await conversations.assertUnprotected(
    {
      threads: [...references.threads],
      resources: [...references.resources],
      runs: [...references.runs],
      messages: [...references.messages],
    },
    storage,
  );
  return references;
}
/** Exact native text/history/approval proxy. Unrelated routes retain the existing billing boundary. */
export function studioChatProxy(
  runtime: StudioAgentRuntime,
  apiPrefix: string,
  fallback: MiddlewareHandler,
): MiddlewareHandler {
  return async (context, next) => {
    const path = context.req.path.startsWith(apiPrefix + '/')
      ? '/api/' + context.req.path.slice(apiPrefix.length + 1)
      : context.req.path;
    const method = context.req.method;
    if (
      method === 'GET' &&
      /^\/agents(?:\/[a-zA-Z0-9_-]+(?:\/chat|\/threads\/[a-zA-Z0-9._:-]+|\/session(?:\/[a-zA-Z0-9._:-]+)?)?)?$/.test(
        path,
      )
    )
      return next();
    const agentRoute = /^\/api\/agents\/([^/]+)(.*)$/.exec(path);
    const memoryRoute = /^\/api\/memory\/(status|config|threads(?:\/([^/]+)(?:\/(messages))?)?)$/.exec(path);
    const canonical = agentRoute ? runtime.aliases.get(decodeURIComponent(agentRoute[1])) : undefined;
    // Shared native Memory is not scoped by Agent. Protect its references before any ordinary fallback.
    try {
      if (!canonical && !runtime.aliases.has(context.req.query('agentId') ?? '')) {
        if (/^\/api\/(agents|memory|workflows)\//.test(path)) {
          const references = await protectConversationMemory(
            context,
            runtime.integration.conversations,
            runtime.integration.storage,
            path,
          );
          if (path.startsWith('/api/memory/')) {
            const selected = context.req.query('agentId') ?? '';
            const ordinaryMemory =
              memoryRoute &&
              runtime.ordinaryAgents.has(selected) &&
              ((method === 'GET' && ['status', 'config'].includes(memoryRoute[1])) ||
                (method === 'GET' &&
                  memoryRoute[1].startsWith('threads') &&
                  (memoryRoute[2] || references.resources.size)) ||
                (method === 'POST' && memoryRoute[1] === 'threads' && references.resources.size));
            if (!ordinaryMemory) return context.json({ error: 'billing_gateway_required' }, 403);
            return next();
          }
        }
        return fallback(context, next);
      }
      if (path.startsWith('/api/memory/') && (!memoryRoute || !runtime.aliases.has(context.req.query('agentId') ?? '')))
        throw new BillingError('forbidden');
      const bearer = /^Bearer ([^\s]+)$/.exec(context.req.header('authorization') ?? '');
      if (!bearer) throw new BillingError('unauthenticated');
      const billing = await runtime.integration.organizations.context({
        credential: bearer[1],
        ...(context.req.header('x-billing-workspace') !== undefined
          ? { workspaceId: context.req.header('x-billing-workspace')! }
          : {}),
      });
      await runtime.integration.organizations.authorize(billing);
      const url = new URL(context.req.url);
      const body: Record<string, any> = method === 'POST' ? await context.req.json() : {};
      if (Number(context.req.header('content-length') ?? 0) > 32768 || JSON.stringify(body).length > 32768)
        throw new BillingError('invalid_input');
      validateOptions(body, [body.streamOptions, body.ifIdle?.streamOptions]);
      if ('modelSettings' in body) throw new BillingError('forbidden');
      for (const options of [body.streamOptions, body.ifIdle?.streamOptions]) {
        if (options !== undefined && !conversationStreamOptions.safeParse(options).success)
          throw new BillingError('forbidden');
      }
      if ('resumeData' in body) throw new BillingError('forbidden');
      if ('messages' in body) throw new BillingError('forbidden');
      if (
        ['/send-message', '/queue-message'].includes(agentRoute?.[2] ?? '') &&
        !message.safeParse(body.message).success
      )
        throw new BillingError('invalid_input');
      if (agentRoute?.[2] === '/signals' && !userSignal.safeParse(body.signal).success)
        throw new BillingError('invalid_input');
      for (const [key, value] of [...url.searchParams]) {
        if (forbiddenKeys.has(key)) throw new BillingError('forbidden');
        if (key === 'requestContext') {
          if (value.length > 64) throw new BillingError('forbidden');
          let json = value;
          if (!value.trimStart().startsWith('{')) {
            const decoded = Buffer.from(value, 'base64');
            if (decoded.toString('base64') !== value) throw new BillingError('forbidden');
            json = decoded.toString('utf8');
          }
          const parsed = emptyContext.safeParse(JSON.parse(json));
          if (!parsed.success) throw new BillingError('forbidden');
          url.searchParams.delete(key);
        }
      }
      let agentId = canonical;
      if (memoryRoute) {
        const selected = url.searchParams.get('agentId');
        if (!selected || !runtime.aliases.has(selected)) throw new BillingError('forbidden');
        agentId = runtime.aliases.get(selected)!;
        url.searchParams.set('agentId', selected);
      }
      if (!agentId) throw new BillingError('forbidden');
      const agent = runtime.agents[agentId];
      const suffix = agentRoute?.[2] ?? '';
      const metadata = agentRoute && method === 'GET' && suffix === '';
      const allowedAgent =
        metadata ||
        (method === 'POST' &&
          [
            '/send-message',
            '/signals',
            '/queue-message',
            '/threads/subscribe',
            '/threads/abort',
            '/send-tool-approval',
          ].includes(suffix)) ||
        (method === 'GET' && suffix === '/suspended-runs') ||
        (method === 'POST' && /^\/runs\/[^/]+\/abort$/.test(suffix));
      const allowedMemory =
        memoryRoute &&
        ((method === 'GET' && ['status', 'config'].includes(memoryRoute[1])) ||
          (method === 'GET' && memoryRoute[1].startsWith('threads')) ||
          (method === 'POST' && memoryRoute[1] === 'threads'));
      if (!allowedAgent && !allowedMemory) throw new BillingError('forbidden');
      context.header('Cache-Control', 'private, no-store');
      const resourceId = await runtime.integration.conversations.resource(billing, agentId);
      const claimedThread = memoryRoute?.[2]
        ? decodeURIComponent(memoryRoute[2])
        : (body.threadId ?? url.searchParams.get('threadId'));
      let threadId = claimedThread as string | undefined;
      const requestedRunId = /^\/runs\/([^/]+)\/abort$/.exec(suffix)?.[1];
      const runId = requestedRunId ?? body.runId ?? url.searchParams.get('runId');
      if (runId) {
        const owner = await runtime.integration.conversations.run(billing, agentId, runId);
        if (threadId && threadId !== owner.threadId) throw new BillingError('forbidden');
        threadId = owner.threadId;
      }
      if (metadata || (memoryRoute && ['status', 'config'].includes(memoryRoute[1]))) {
        context.req.raw = new Request(url, {
          method,
          headers: context.req.raw.headers,
          signal: context.req.raw.signal,
        });
        return next();
      }
      if (suffix === '/suspended-runs' && !threadId) {
        url.searchParams.set('resourceId', resourceId);
        context.req.raw = new Request(url, { headers: context.req.raw.headers, signal: context.req.raw.signal });
        return next();
      }
      if (memoryRoute && method === 'GET' && memoryRoute[1] === 'threads') {
        url.searchParams.set('resourceId', resourceId);
        context.req.raw = new Request(url, {
          method,
          headers: context.req.raw.headers,
          signal: context.req.raw.signal,
        });
        return next();
      }
      if (memoryRoute && method === 'POST' && memoryRoute[1] === 'threads' && !threadId) threadId = randomUUID();
      if (!threadId || !identifierSchema.safeParse(threadId).success) throw new BillingError('invalid_input');
      const create =
        (method === 'POST' &&
          ['/send-message', '/signals', '/queue-message', '/threads/subscribe'].includes(suffix) &&
          !runId) ||
        (memoryRoute?.[1] === 'threads' && method === 'POST');
      const nativeThread = create ? await (await agent.getMemory())?.getThreadById({ threadId }) : null;
      const owner = await runtime.integration.conversations.thread(
        billing,
        agentId,
        threadId,
        !!create,
        !!nativeThread,
      );
      const stopping = suffix === '/threads/abort' || /^\/runs\/[^/]+\/abort$/.test(suffix);
      if (!stopping) await runtime.settled(threadId);
      const selected = { billing, owner, controller: new AbortController() };
      const conversation = method === 'GET' ? runtime.requestLocal(selected) : runtime.bind(selected);
      if (method === 'POST') {
        body.threadId = threadId;
        body.resourceId = resourceId;
      }
      if (method === 'GET') url.searchParams.set('resourceId', resourceId);
      context.req.raw = new Request(url, {
        method,
        headers: context.req.raw.headers,
        signal: context.req.raw.signal,
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
      });
      // Hono can cache text rather than parsed JSON. Downstream public body readers
      // must parse the same rewritten request as native adapters reading raw.
      context.req.bodyCache = {};
      if (stopping) {
        const aborted = runtime.request.run(conversation, () =>
          runtime.stop(conversation, agent, requestedRunId ? runId : body.expectedRunId),
        );
        await runtime.settled(threadId);
        return context.json({ aborted });
      }
      if (suffix === '/threads/subscribe') {
        // Only a long-lived browser subscription disappearing ends conversation activity.
        const subscription = Symbol();
        runtime.subscriptions.set(threadId, subscription);
        const signal = context.req.raw.signal;
        let cleanup: Promise<void> | undefined;
        const disconnect = () =>
          (cleanup ??= (async () => {
            signal.removeEventListener('abort', onAbort);
            try {
              if (runtime.subscriptions.get(threadId!) === subscription)
                runtime.request.run(conversation, () => runtime.stop(conversation, agent));
            } finally {
              await runtime.release(conversation, subscription);
            }
          })());
        const onAbort = () => {
          void disconnect().catch(() => {});
        };
        signal.addEventListener('abort', onAbort, { once: true });
        try {
          if (signal.aborted) {
            await disconnect();
            return context.body(null, 204);
          }
          await runtime.request.run(conversation, next);
          if (!context.res.body) {
            await disconnect();
            return;
          }
          const reader = context.res.body.getReader();
          context.res = new Response(
            new ReadableStream({
              async pull(controller) {
                try {
                  const part = await reader.read();
                  if (part.done) {
                    await disconnect();
                    reader.releaseLock();
                    controller.close();
                  } else controller.enqueue(part.value);
                } catch (error) {
                  await disconnect().catch(() => {});
                  reader.releaseLock();
                  controller.error(error);
                }
              },
              async cancel(reason) {
                const closing = disconnect();
                try {
                  await reader.cancel(reason);
                } finally {
                  reader.releaseLock();
                  await closing;
                }
              },
            }),
            context.res,
          );
        } catch (error) {
          await disconnect().catch(() => {});
          throw error;
        }
        return;
      }
      return runtime.request.run(conversation, next);
    } catch (error) {
      return studioChatFailure(context, error);
    }
  };
}
