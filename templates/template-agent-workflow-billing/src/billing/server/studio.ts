import { AsyncLocalStorage } from 'node:async_hooks';
import { createTool } from '@mastra/core/tools';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { BillingError, identifierSchema } from '../contracts.js';
import type { BillingHttpGateway } from '../mastra.js';
import type { OrganizationService } from '../organizations.js';
import type { CommercialService } from '../commercial.js';
import type { ResourceAction } from '../resource-catalog.js';

const selectionSchema = z.strictObject({ workspaceId: identifierSchema });

export function createBillingStudio({
  organizations,
  execution,
  commercial,
  actions,
}: {
  /** Trusted identity and membership service. */
  organizations: OrganizationService;
  /** Billing facade shared with the authenticated HTTP routes. */
  execution: BillingHttpGateway;
  /** Owner-authorized commercial operations. */
  commercial: CommercialService;
  /** Validated resource actions exposed as Studio tools. */
  actions: readonly ResourceAction[];
}) {
  // Never accept credentials or actor IDs from Studio's editable request context.
  const request = new AsyncLocalStorage<string>();
  const selected = (workspaceId: string) => {
    const credential = request.getStore();
    if (!credential) throw new BillingError('unauthenticated');
    return organizations.context({ credential, workspaceId });
  };
  const safely = async <T>(action: () => Promise<T>) => {
    try {
      return await action();
    } catch (error) {
      const safe = error instanceof BillingError ? error : new BillingError('state_unavailable');
      return { error: { code: safe.code, message: safe.message, retryable: safe.retryable } };
    }
  };
  const tools = {
    'billing-account': createTool({
      id: 'billing-account',
      description: 'Read the workspace credit balance, consumption and reservations. Requires the billing owner.',
      inputSchema: selectionSchema,
      execute: input => safely(async () => commercial.usage(await selected(input.workspaceId))),
    }),
  };
  for (const action of actions) {
    Object.assign(tools, {
      [action.id]: createTool({
        id: action.id,
        description: action.description,
        inputSchema: action.inputSchema,
        // The SDK already applied inputSchema, including its transformations.
        execute: input => safely(() => action.executeValidated(input, { execution, selected })),
      }),
    });
  }
  const toolIds = new Set(Object.keys(tools));
  const limit = bodyLimit({
    maxSize: 16 * 1024,
    onError: context => context.json({ error: { code: 'invalid_input' } }, 413),
  });
  const middleware: MiddlewareHandler = async (context, next) => {
    const { path, method } = context.req;
    if (path === '/' && method === 'GET') return context.redirect('/tools');
    if (path.startsWith('/billing/')) return next();
    const publicShell =
      method === 'GET' &&
      ([
        '/tools',
        '/settings',
        '/favicon.ico',
        '/api/auth/capabilities',
        '/refresh-events',
        '/__hot-reload-status',
      ].includes(path) ||
        /^\/tools\/[a-zA-Z0-9-]+$/.test(path) ||
        /^\/assets\/[a-zA-Z0-9._/-]+$/.test(path));
    if (publicShell) return next();
    const match = /^\/api\/tools\/([a-zA-Z0-9-]+)(\/execute)?$/.exec(path);
    const toolRoute =
      (['/api/tools', '/api/agents'].includes(path) && method === 'GET') ||
      (match && toolIds.has(match[1]) && (match[2] ? method === 'POST' : method === 'GET'));
    if (!toolRoute) return context.json({ error: 'billing_gateway_required' }, 403);
    const bearer = /^Bearer ([^\s]+)$/.exec(context.req.header('authorization') ?? '');
    if (!bearer) return context.json({ error: { code: 'unauthenticated' } }, 401);
    try {
      await organizations.identity.authenticate(bearer[1]);
    } catch {
      return context.json({ error: { code: 'unauthenticated' } }, 401);
    }
    context.header('Cache-Control', 'no-store');
    return limit(context, () => request.run(bearer[1], next));
  };
  return { tools, middleware };
}
