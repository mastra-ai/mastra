import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { BillingError, identifierSchema } from '../billing/contracts.js';
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
const conversationStreamOptions = z.strictObject({
  maxSteps: z.number().int().min(1).max(32).optional(),
  modelSettings: conversationModelSettings.optional(),
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
function validateOptions(value: unknown, depth = 0): void {
  if (!value || typeof value !== 'object') return;
  if (depth > 12) throw new BillingError('invalid_input');
  for (const [key, entry] of Object.entries(value)) {
    if (
      (key === 'modelSettings' && !conversationModelSettings.safeParse(entry).success) ||
      forbiddenKeys.has(key) ||
      (key === 'requestContext' && entry && Object.keys(entry).length)
    )
      throw new BillingError('forbidden');
    // Text message/tool input content is data, not execution options.
    if (!['message', 'messages', 'signal', 'resumeData'].includes(key)) validateOptions(entry, depth + 1);
  }
}
const safeFailure = (context: Context, error: unknown) => {
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
    // Decorated routes must never fall through to ordinary native allowlists.
    if (!canonical && !path.startsWith('/api/memory/')) return fallback(context, next);
    if (path.startsWith('/api/memory/') && (!memoryRoute || !runtime.aliases.has(context.req.query('agentId') ?? '')))
      return context.json({ error: 'billing_gateway_required' }, 403);
    try {
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
      validateOptions(body);
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
      const resourceId = runtime.integration.conversations.resource(billing, agentId);
      const claimedThread = memoryRoute?.[2]
        ? decodeURIComponent(memoryRoute[2])
        : (body.threadId ?? url.searchParams.get('threadId'));
      let threadId = claimedThread as string | undefined;
      const runId = body.runId ?? /^\/runs\/([^/]+)\/abort$/.exec(suffix)?.[1] ?? url.searchParams.get('runId');
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
      const owner = await runtime.integration.conversations.thread(billing, agentId, threadId, !!create);
      const stopping = suffix === '/threads/abort' || /^\/runs\/[^/]+\/abort$/.test(suffix);
      if (!stopping) await runtime.settled(threadId);
      const conversation = runtime.bind({ billing, owner, controller: new AbortController() });
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
        const aborted = runtime.request.run(conversation, () => runtime.stop(conversation, agent, body.expectedRunId));
        await runtime.settled(threadId);
        return context.json({ aborted });
      }
      if (suffix === '/threads/subscribe') {
        // Only a long-lived browser subscription disappearing ends conversation activity.
        const subscription = Symbol();
        runtime.subscriptions.set(threadId, subscription);
        const disconnect = () => {
          if (runtime.subscriptions.get(threadId!) === subscription)
            runtime.request.run(conversation, () => runtime.stop(conversation, agent));
        };
        context.req.raw.signal.addEventListener('abort', disconnect, { once: true });
        await runtime.request.run(conversation, next);
        if (context.res.body) {
          const stream = context.res.body;
          const reader = stream.getReader();
          context.res = new Response(
            new ReadableStream({
              async pull(controller) {
                const part = await reader.read();
                if (part.done) controller.close();
                else controller.enqueue(part.value);
              },
              async cancel(reason) {
                disconnect();
                await reader.cancel(reason);
              },
            }),
            context.res,
          );
        }
        return;
      }
      return runtime.request.run(conversation, next);
    } catch (error) {
      return safeFailure(context, error);
    }
  };
}
