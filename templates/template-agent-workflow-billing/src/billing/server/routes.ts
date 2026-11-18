import type { BillingServerOptions } from '../contracts/server.js';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import { BillingError, parseInput } from '../contracts/core.js';
import { boundedJsonSchema } from '../runtime/accounting.js';
import { identifierSchema } from '../contracts/core.js';

export function createBillingApp({ organizations, execution, commercial, artifacts }: BillingServerOptions) {
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
  const selected = (context: { get(key: 'credential'): string; req: { param(key: 'workspaceId'): string } }) =>
    organizations.context({ credential: context.get('credential'), workspaceId: context.req.param('workspaceId') });
  app.get('/billing/context', async context =>
    context.json(await organizations.context({ credential: context.get('credential') })),
  );
  app.get('/billing/workspaces/:workspaceId', async context => context.json(await selected(context)));
  app.post('/billing/workspaces/:workspaceId/convert', async context => {
    const input = await body(context.req);
    // Empty input must still reject protected actor/account fields.
    parseInput(z.strictObject({}), input);
    const billing = await selected(context);
    return context.json(await organizations.convert(billing, key(context.req.header('idempotency-key'))));
  });
  app.post('/billing/workspaces/:workspaceId/invitations', async context => {
    const billing = await selected(context);
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
    const billing = await selected(context);
    return context.json(await organizations.members(billing));
  });
  app.patch('/billing/workspaces/:workspaceId/members', async context => {
    const billing = await selected(context);
    return context.json(
      await organizations.changeMember(billing, key(context.req.header('idempotency-key')), await body(context.req)),
    );
  });
  app.get('/billing/workspaces/:workspaceId/billing-access', async context => {
    const billing = await selected(context);
    const authorized = await organizations.authorize(billing, 'manage-billing');
    return context.json({
      actorId: authorized.actorId,
      workspaceId: authorized.workspaceId,
      permission: 'manage-billing',
    });
  });
  app.get('/billing/workspaces/:workspaceId/private-records/:recordId', async context => {
    const billing = await selected(context);
    return context.json(await organizations.readPrivateRecord(billing, context.req.param('recordId')));
  });
  if (execution) {
    app.post('/billing/workspaces/:workspaceId/agents/:resourceId/generate', async context => {
      const input = parseInput(z.strictObject({ prompt: z.string().min(1).max(8192) }), await body(context.req));
      const resourceId = parseInput(identifierSchema, context.req.param('resourceId'));
      return context.json(
        await execution.generate(
          resourceId,
          input.prompt,
          await selected(context),
          key(context.req.header('idempotency-key')),
        ),
      );
    });
    app.post('/billing/workspaces/:workspaceId/workflows/:resourceId/runs', async context => {
      parseInput(z.strictObject({}), await body(context.req));
      return context.json(
        await execution.createRun(
          parseInput(identifierSchema, context.req.param('resourceId')),
          await selected(context),
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
          await selected(context),
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
          await selected(context),
          key(context.req.header('idempotency-key')),
          value,
        ),
      );
    });
  }
  if (artifacts) {
    app.get('/billing/workspaces/:workspaceId/artifacts/:artifactId', async context => {
      const billing = await selected(context);
      const artifact = await artifacts.read(
        await organizations.accountingIdentity(billing),
        context.req.param('artifactId'),
      );
      if (!artifact)
        return context.json(
          { error: { code: 'artifact_unavailable', message: 'The saved image is unavailable.', retryable: false } },
          410,
        );
      return new Response(artifact.bytes as BodyInit, {
        headers: {
          'content-type': artifact.mime,
          'content-disposition': `attachment; filename="${artifact.filename}"`,
          'cache-control': 'private, no-store',
          'x-content-type-options': 'nosniff',
          'content-security-policy': "default-src 'none'; sandbox",
          'content-length': String(artifact.bytes.length),
        },
      });
    });
  }
  if (commercial) {
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

export function billingApiRoutes(options: BillingServerOptions): ApiRoute[] {
  const app = createBillingApp(options);
  // Mastra's custom Hono route passes through this application's own auth middleware.
  return [
    registerApiRoute('/billing/*', {
      method: 'ALL',
      requiresAuth: false,
      handler: context => app.fetch(context.req.raw),
    }),
  ];
}
