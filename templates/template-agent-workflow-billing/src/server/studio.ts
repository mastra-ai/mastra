import { AsyncLocalStorage } from 'node:async_hooks';
import { createTool } from '@mastra/core/tools';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { BillingError, identifierSchema } from '../billing/contracts.js';
import type { BillingHttpGateway } from '../billing/mastra.js';
import type { OrganizationService } from '../billing/organizations.js';
import type { CommercialService } from '../billing/commercial.js';
import { observationsSchema, reportApprovalSchema, weatherPrompt } from '../weather/observations.js';

const selectionSchema = z.strictObject({ workspaceId: identifierSchema });
const operationSchema = selectionSchema.extend({ idempotencyKey: identifierSchema });
const runSchema = selectionSchema.extend({ executionId: identifierSchema });
const resumeSchema = runSchema.extend({ idempotencyKey: identifierSchema, approval: reportApprovalSchema });

export function createBillingStudio(
  organizations: OrganizationService,
  execution: BillingHttpGateway,
  commercial: CommercialService,
) {
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
    'billing-weather-summary': createTool({
      id: 'billing-weather-summary',
      description:
        'Summarize supplied weather observations through billing. Returns the summary and receipt. Reuse the same idempotency key and input to replay without another charge.',
      inputSchema: operationSchema.extend({ observations: observationsSchema }),
      execute: input =>
        safely(async () =>
          execution.generate(
            'weather-agent',
            weatherPrompt(input.observations),
            await selected(input.workspaceId),
            input.idempotencyKey,
          ),
        ),
    }),
    'billing-weather-report-start': createTool({
      id: 'billing-weather-report-start',
      description:
        'Draft a weather report and reserve its charge while waiting for approval. Save the returned executionId.',
      inputSchema: operationSchema.extend({ observations: observationsSchema }),
      execute: input =>
        safely(async () => {
          const billing = await selected(input.workspaceId);
          const { executionId } = await execution.createRun('weather-report', billing, input.idempotencyKey);
          return execution.workflowOperation(
            'weather-report',
            executionId,
            'start',
            billing,
            input.idempotencyKey,
            input.observations,
          );
        }),
    }),
    'billing-weather-report-status': createTool({
      id: 'billing-weather-report-status',
      description: 'Read your private weather report and receipt, including after a server restart.',
      inputSchema: runSchema,
      execute: input =>
        safely(async () =>
          execution.workflowOperation(
            'weather-report',
            input.executionId,
            'status',
            await selected(input.workspaceId),
            undefined,
            null,
          ),
        ),
    }),
    'billing-weather-report-approve': createTool({
      id: 'billing-weather-report-approve',
      description: 'Approve your suspended weather report. Successful completion captures the reservation once.',
      inputSchema: resumeSchema,
      execute: input =>
        safely(async () =>
          execution.workflowOperation(
            'weather-report',
            input.executionId,
            'resume',
            await selected(input.workspaceId),
            input.idempotencyKey,
            { step: 'approval', resumeData: input.approval },
          ),
        ),
    }),
    'billing-weather-report-cancel': createTool({
      id: 'billing-weather-report-cancel',
      description: 'Cancel your suspended weather report and release its reservation without charging.',
      inputSchema: runSchema.extend({ idempotencyKey: identifierSchema }),
      execute: input =>
        safely(async () =>
          execution.workflowOperation(
            'weather-report',
            input.executionId,
            'cancel',
            await selected(input.workspaceId),
            input.idempotencyKey,
            {},
          ),
        ),
    }),
  };
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
