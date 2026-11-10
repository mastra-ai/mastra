import { timingSafeEqual } from 'node:crypto';
import { SimpleAuth } from '@mastra/core/server';
import type { MiddlewareHandler, ServerConfig } from '@mastra/core/server';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { z } from 'zod';
import type { AssistantConfig } from './config';

const executionOptions = new Set([
  'model',
  'structuredOutput',
  'memory',
  'memoryConfig',
  'inputProcessors',
  'outputProcessors',
  'maxSteps',
  'hooks',
  'toolCallConcurrency',
  'eagerToolExecution',
  'streamOptions',
  'ifIdle',
  'autoResumeSuspendedTools',
  'toolsets',
  'clientTools',
  'resumeData',
]);

/** Inspect option objects without interpreting message contents. */
function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** Preserve the exact status-tool exception while denying direct protected-tool execution. */
const protectDirectExecution: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'POST') return next();
  const denied = () =>
    c.json(
      {
        error: 'Use the assistant conversation and native approval controls for connected tool execution.',
      },
      403,
    );
  // Hono matches and decodes the route parameters, including encoded path segments.
  if (c.req.param('toolId') !== 'connection-status') return denied();
  const identifiers = { toolId: 'connection-status', agentId: c.req.param('agentId') };
  // Native handlers merge URL, query and body parameters. The exception must not select another tool/agent.
  for (const [key, values] of Object.entries(c.req.queries())) {
    const identifier = key.split('[')[0] as keyof typeof identifiers;
    if (
      Object.hasOwn(identifiers, identifier) &&
      (key !== identifier || values.length !== 1 || values[0] !== identifiers[identifier])
    )
      return denied();
  }
  let body: Record<string, unknown> | undefined;
  try {
    const request = c.req.raw.clone();
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      body = {};
      for (const key of Object.keys(identifiers)) {
        const field = form.getAll(key).at(-1);
        if (field === undefined) continue;
        body[key] = field;
        if (typeof field === 'string') {
          try {
            body[key] = JSON.parse(field);
          } catch {}
        }
      }
    } else if (contentType.includes('application/json')) {
      body = asObject(await request.json());
    }
  } catch {
    // Preserve native malformed-body and unsupported-content-type errors.
  }
  for (const key of Object.keys(identifiers) as (keyof typeof identifiers)[]) {
    if (body && Object.hasOwn(body, key) && body[key] !== identifiers[key]) return denied();
  }
  await next();
};

/** Protect owner API access and validate every supported execution-option location. */
export function createAssistantServer(
  config: AssistantConfig,
  schedules: { canRead(scheduleId: string): Promise<boolean> },
): ServerConfig {
  const runLimits = z.object({ maxSteps: z.number().int().min(1).max(config.maxSteps).optional() });
  const concurrency = z.union([
    z.literal(1),
    z.object({ limit: z.literal(1), strategy: z.literal('called').optional() }).strict(),
  ]);
  const auth = new SimpleAuth({
    tokens: { [config.runtime.ownerToken]: { id: config.ownerId } },
    mapUserToResourceId: () => config.ownerId,
  });
  const ownerBearer = Buffer.from(`Bearer ${config.runtime.ownerToken}`);
  let requestWindow = Date.now();
  let requests = 0;
  return {
    host: config.runtime.mode === 'local' ? '127.0.0.1' : '0.0.0.0',
    bodySizeLimit: 1048576,
    auth,
    middleware: [
      async (c, next) => {
        if (!c.req.path.startsWith('/api/')) return next();
        const supplied = Buffer.from(c.req.header('authorization') ?? '');
        const validBearer = supplied.length === ownerBearer.length && timingSafeEqual(supplied, ownerBearer);
        // Cookies are ambient credentials. Require same-origin browser evidence for cookie mutations.
        if (config.runtime.mode === 'local' && !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && !validBearer) {
          if (c.req.header('sec-fetch-site') !== 'same-origin' || c.req.header('origin') !== new URL(c.req.url).origin)
            return c.json({ error: 'A bearer token or same-origin authenticated Studio request is required.' }, 401);
        }
        // Match the native adapter's token precedence and delegate cookie/header validation to SimpleAuth.
        const token = c.req.header('authorization')?.replace('Bearer ', '') || c.req.query('apiKey') || '';
        const authenticated = validBearer || (await auth.authenticateToken(token, c.req.raw))?.id === config.ownerId;
        if (authenticated) {
          const now = Date.now();
          if (now - requestWindow >= 60000) {
            requestWindow = now;
            requests = 0;
          }
          if (++requests > config.limits.requestsPerMinute)
            return c.json({ error: 'Assistant request capacity exhausted.' }, 429, { 'Retry-After': '60' });
        }
        await next();
      },
      { path: '/api/tools/:toolId/execute', handler: protectDirectExecution },
      { path: '/api/agents/:agentId/tools/:toolId/execute', handler: protectDirectExecution },
      async (c, next) => {
        // Native handlers honor this server-owned value over request bodies and headers.
        c.get('requestContext').set(MASTRA_RESOURCE_ID_KEY, config.ownerId);
        if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && /\/agents\/[^/]+\/models?(?:\/|$)/.test(c.req.path))
          return c.json(
            { error: 'Configure models on the server so all execution uses the shared model budget.' },
            403,
          );
        const schedulePath = c.req.path.match(/\/schedules(?:\/(.*))?$/);
        if (schedulePath) {
          try {
            if (c.req.method !== 'GET')
              return c.json({ error: 'Manage schedules through the assistant conversation.' }, 403);
            const segments = (schedulePath[1] ?? '').split('/').filter(Boolean);
            if (segments.length > 2 || (segments.length === 2 && segments[1] !== 'triggers'))
              return c.json({ error: 'Schedule route not found.' }, 404);
            if (segments[0]) {
              let scheduleId: string;
              try {
                scheduleId = decodeURIComponent(segments[0]);
              } catch {
                return c.json({ error: 'Schedule not found.' }, 404);
              }
              if (!(await schedules.canRead(scheduleId))) return c.json({ error: 'Schedule not found.' }, 404);
            }
            await next();
            if (c.res.status >= 500) {
              c.res = c.json({ error: 'Schedule storage is unavailable. Try again after recovery.' }, 503);
              return;
            }
            if (!segments[0] && c.res.ok) {
              const body = await c.res.clone().json();
              const visible = [];
              for (const value of body.schedules ?? []) if (await schedules.canRead(value.id)) visible.push(value);
              c.res = c.json({ ...body, schedules: visible });
            }
            return;
          } catch {
            c.res = c.json({ error: 'Schedule storage is unavailable. Try again after recovery.' }, 503);
            return c.res;
          }
        }
        if (c.req.method === 'POST' && c.req.path.includes('/agents/')) {
          if (Object.keys(c.req.queries()).some(key => executionOptions.has(key.split(/[.\[\]]/)[0]!)))
            return c.json({ error: 'Supply execution options in the validated request body, never the query.' }, 400);
          let value: unknown;
          try {
            const request = c.req.raw.clone();
            const contentType = c.req.header('content-type') || '';
            if (contentType.includes('multipart/form-data')) {
              const form = await request.formData();
              const fields: Record<string, unknown> = {};
              // Native Hono JSON-decodes form fields and uses the last duplicate value.
              for (const key of executionOptions) {
                const field = form.getAll(key).at(-1);
                if (field === undefined) continue;
                fields[key] = field;
                if (typeof field === 'string') {
                  try {
                    fields[key] = JSON.parse(field);
                  } catch {}
                }
              }
              value = fields;
            } else if (contentType.includes('application/json')) {
              value = await request.json();
            }
          } catch {
            // Native routes own malformed bodies and unsupported content types.
          }
          const body = asObject(value);
          if (
            body?.resumeData !== undefined &&
            /\/(?:resume-stream(?:-until-idle)?|send-tool-approval)$/.test(c.req.path) &&
            !z.object({ approved: z.boolean(), reason: z.string().optional() }).strict().safeParse(body.resumeData)
              .success
          ) {
            return c.json(
              {
                error:
                  'Approval resume data must contain only the native decision and optional reason; arguments cannot be changed.',
              },
              400,
            );
          }
          // Only known execution-option objects are inspected, never message contents.
          const options = [body, asObject(body?.streamOptions), asObject(asObject(body?.ifIdle)?.streamOptions)];
          if (
            options.some(
              option =>
                option &&
                (option.model !== undefined ||
                  asObject(option.structuredOutput)?.model !== undefined ||
                  asObject(option.memory)?.options !== undefined ||
                  option.memoryConfig !== undefined ||
                  option.inputProcessors !== undefined ||
                  option.outputProcessors !== undefined ||
                  option.autoResumeSuspendedTools === true ||
                  option.toolsets !== undefined ||
                  option.clientTools !== undefined ||
                  option.hooks !== undefined),
            )
          ) {
            return c.json(
              { error: 'Model/processor overrides, tool injection and automatic approval recovery are not allowed.' },
              400,
            );
          }
          if (
            options.some(
              option =>
                option &&
                ((option.toolCallConcurrency !== undefined &&
                  !concurrency.safeParse(option.toolCallConcurrency).success) ||
                  option.eagerToolExecution === true),
            )
          ) {
            return c.json(
              {
                error: 'Stateful tools require toolCallConcurrency 1 in called order and eagerToolExecution false.',
              },
              400,
            );
          }
          if (options.some(option => option && !runLimits.safeParse(option).success)) {
            return c.json({ error: `maxSteps must be an integer between 1 and ${config.maxSteps}.` }, 400);
          }
        }
        await next();
      },
    ],
  };
}
