import type { BillingRecovery } from '../billing/recovery.js';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import { BillingError, parseInput } from '../billing/contracts.js';
import type { OrganizationService } from '../billing/organizations.js';
import type { CommercialService } from '../billing/commercial.js';
import type { BillingHttpGateway } from '../billing/mastra.js';
import { boundedJsonSchema } from '../billing/accounting.js';
import { identifierSchema } from '../billing/contracts.js';

export function createBillingApp(
  organizations: OrganizationService,
  execution?: BillingHttpGateway,
  commercial?: CommercialService,
  recovery?: BillingRecovery,
) {
  const app = new Hono<{ Variables: { credential: string } }>();
  app.onError((error, context) => {
    const safe = error instanceof BillingError ? error : new BillingError('storage_unavailable');
    const status = {
      unauthenticated: 401,
      forbidden: 403,
      invalid_input: 400,
      conflict: 409,
      account_not_found: 404,
      unsupported: 501,
      insufficient_credits: 409,
      invalid_configuration: 503,
      storage_incompatible: 503,
      storage_unavailable: 503,
      state_unavailable: 503,
    } as const;
    return context.json(
      { error: { code: safe.code, message: safe.message, retryable: safe.retryable } },
      status[safe.code],
    );
  });
  app.use(
    '/billing/*',
    bodyLimit({
      maxSize: 16 * 1024,
      onError: context =>
        context.json(
          { error: { code: 'invalid_input', message: 'Billing request body is too large.', retryable: false } },
          413,
        ),
    }),
  );
  // Only this exact method/path is signature authenticated. Every other billing
  // route still traverses bearer authentication, including webhook lookalikes.
  if (recovery)
    app.post('/billing/webhooks/:provider', async context => {
      const headers: Record<string, string> = {};
      context.req.raw.headers.forEach((value, key) => {
        headers[key] = value;
      });
      await recovery.intake(
        { body: new Uint8Array(await context.req.raw.arrayBuffer()), headers },
        parseInput(identifierSchema, context.req.param('provider')),
      );
      return context.json({ received: true }, 202);
    });
  app.use('/billing/*', async (context, next) => {
    const header = context.req.header('authorization');
    const bearer = /^Bearer ([^\s]+)$/.exec(header ?? '');
    if (!bearer) throw new BillingError('unauthenticated');
    // The service rechecks credentials and current SQL authorization at each operation.
    await organizations.identity.authenticate(bearer[1]);
    context.set('credential', bearer[1]);
    await next();
  });
  const body = async (request: { json(): Promise<unknown> }): Promise<unknown> => {
    try {
      return await request.json();
    } catch {
      throw new BillingError('invalid_input');
    }
  };
  const key = (header: string | undefined): string => {
    if (!header) throw new BillingError('invalid_input');
    return header;
  };
  app.get('/billing/context', async context =>
    context.json(await organizations.context({ credential: context.get('credential') })),
  );
  app.get('/billing/workspaces/:workspaceId', async context =>
    context.json(
      await organizations.context({
        credential: context.get('credential'),
        workspaceId: context.req.param('workspaceId'),
      }),
    ),
  );
  app.post('/billing/workspaces/:workspaceId/convert', async context => {
    const input = await body(context.req);
    // Empty input must still reject protected actor/account fields.
    parseInput(z.strictObject({}), input);
    const billing = await organizations.context({
      credential: context.get('credential'),
      workspaceId: context.req.param('workspaceId'),
    });
    return context.json(await organizations.convert(billing, key(context.req.header('idempotency-key'))));
  });
  app.post('/billing/workspaces/:workspaceId/invitations', async context => {
    const billing = await organizations.context({
      credential: context.get('credential'),
      workspaceId: context.req.param('workspaceId'),
    });
    return context.json(
      await organizations.invite(billing, key(context.req.header('idempotency-key')), await body(context.req)),
    );
  });
  app.post('/billing/invitations/accept', async context => {
    const invitation = parseInput(
      z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
      await body(context.req),
    );
    return context.json(
      await organizations.acceptInvitation({
        credential: context.get('credential'),
        key: key(context.req.header('idempotency-key')),
        token: invitation.token,
      }),
    );
  });
  app.get('/billing/workspaces/:workspaceId/members', async context => {
    const billing = await organizations.context({
      credential: context.get('credential'),
      workspaceId: context.req.param('workspaceId'),
    });
    return context.json(await organizations.members(billing));
  });
  app.patch('/billing/workspaces/:workspaceId/members', async context => {
    const billing = await organizations.context({
      credential: context.get('credential'),
      workspaceId: context.req.param('workspaceId'),
    });
    return context.json(
      await organizations.changeMember(billing, key(context.req.header('idempotency-key')), await body(context.req)),
    );
  });
  app.get('/billing/workspaces/:workspaceId/billing-access', async context => {
    const billing = await organizations.context({
      credential: context.get('credential'),
      workspaceId: context.req.param('workspaceId'),
    });
    const authorized = await organizations.authorize(billing, 'manage-billing');
    return context.json({
      actorId: authorized.actorId,
      workspaceId: authorized.workspaceId,
      permission: 'manage-billing',
    });
  });
  app.get('/billing/workspaces/:workspaceId/private-records/:recordId', async context => {
    const billing = await organizations.context({
      credential: context.get('credential'),
      workspaceId: context.req.param('workspaceId'),
    });
    return context.json(await organizations.readPrivateRecord(billing, context.req.param('recordId')));
  });
  if (execution) {
    const selection = async (context: { get(key: 'credential'): string; req: { param(key: 'workspaceId'): string } }) =>
      organizations.context({ credential: context.get('credential'), workspaceId: context.req.param('workspaceId') });
    app.post('/billing/workspaces/:workspaceId/agents/:resourceId/generate', async context => {
      const input = parseInput(z.strictObject({ prompt: z.string().min(1).max(8192) }), await body(context.req));
      const resourceId = parseInput(identifierSchema, context.req.param('resourceId'));
      return context.json(
        await execution.generate(
          resourceId,
          input.prompt,
          await selection(context),
          key(context.req.header('idempotency-key')),
        ),
      );
    });
    app.post('/billing/workspaces/:workspaceId/workflows/:resourceId/runs', async context => {
      parseInput(z.strictObject({}), await body(context.req));
      return context.json(
        await execution.createRun(
          parseInput(identifierSchema, context.req.param('resourceId')),
          await selection(context),
          key(context.req.header('idempotency-key')),
        ),
      );
    });
    app.get('/billing/workspaces/:workspaceId/workflows/:resourceId/runs/:executionId', async context =>
      context.json(
        await execution.workflowOperation(
          parseInput(identifierSchema, context.req.param('resourceId')),
          parseInput(identifierSchema, context.req.param('executionId')),
          'status',
          await selection(context),
          undefined,
          null,
        ),
      ),
    );
    app.post('/billing/workspaces/:workspaceId/workflows/:resourceId/runs/:executionId/:operation', async context => {
      const operation = parseInput(z.enum(['start', 'resume', 'cancel']), context.req.param('operation'));
      const input = await body(context.req);
      const value =
        operation === 'start'
          ? parseInput(z.strictObject({ inputData: boundedJsonSchema }), input).inputData
          : operation === 'resume'
            ? parseInput(z.strictObject({ step: identifierSchema, resumeData: boundedJsonSchema }), input)
            : parseInput(z.strictObject({}), input);
      return context.json(
        await execution.workflowOperation(
          parseInput(identifierSchema, context.req.param('resourceId')),
          parseInput(identifierSchema, context.req.param('executionId')),
          operation,
          await selection(context),
          key(context.req.header('idempotency-key')),
          value,
        ),
      );
    });
  }
  if (commercial) {
    const selected = (context: { get(key: 'credential'): string; req: { param(key: 'workspaceId'): string } }) =>
      organizations.context({ credential: context.get('credential'), workspaceId: context.req.param('workspaceId') });
    app.get('/billing/workspaces/:workspaceId/usage', async context =>
      context.json(await commercial.usage(await selected(context))),
    );
    app.post('/billing/workspaces/:workspaceId/checkout', async context =>
      context.json(
        await commercial.checkout(
          await selected(context),
          key(context.req.header('idempotency-key')),
          await body(context.req),
        ),
      ),
    );
    app.post('/billing/workspaces/:workspaceId/portal', async context =>
      context.json(
        await commercial.portal(
          await selected(context),
          key(context.req.header('idempotency-key')),
          await body(context.req),
        ),
      ),
    );
  }
  return app;
}

export function billingApiRoutes(
  organizations: OrganizationService,
  execution?: BillingHttpGateway,
  commercial?: CommercialService,
  recovery?: BillingRecovery,
): ApiRoute[] {
  const app = createBillingApp(organizations, execution, commercial, recovery);
  // Mastra's custom Hono route passes through this application's own auth middleware.
  return [
    registerApiRoute('/billing/*', {
      method: 'ALL',
      requiresAuth: false,
      handler: context => app.fetch(context.req.raw),
    }),
  ];
}
