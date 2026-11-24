import { MastraServer } from '@mastra/hono';
import type { Mastra } from '@mastra/core/mastra';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import type { OperationalStore } from './db/operational-store.js';
import { hasEnabledIntegration, type ServerConfig, type IntegrationConfig } from './env.js';
import { errorResponse } from './http-errors.js';
import { defensiveHeadersMiddleware, requestContextMiddleware, type AppEnv } from './http-context.js';
import { consoleLogger, requestLoggingMiddleware, type StructuredLogger } from './logging.js';
import { registerWebhookRoutes } from './app/webhooks/routes.js';
import { registerApprovalRoutes } from './approval/routes.js';
import { LocalDecisionAuthenticator } from './approval/local-decision-authenticator.js';
import { createWorkflowApprovalRunReconciler, type ApprovalWorkflow } from './approval/workflow-resume-reconciler.js';
import { readApprovalConfig, type ApprovalConfig } from './env.js';
import { readDashboardConfig, type DashboardConfig } from './env.js';
import { createWorkosDashboardSessionClient } from './app/auth/workos-session.js';
import { registerDashboardRoutes } from './app/dashboard/routes.js';
import type { WebhookClientKeyResolver, WebhookRateLimiter } from './webhook-rate-limit.js';

export async function createApp(
  input: Readonly<{
    config: ServerConfig;
    store: OperationalStore;
    logger?: StructuredLogger;
    createRequestId?: () => string;
    nowMs?: () => number;
    mastraInstance?: Mastra;
    approvalConfig?: ApprovalConfig;
    dashboardConfig?: DashboardConfig;
    integrationConfig?: IntegrationConfig;
    webhookRateLimiter?: WebhookRateLimiter;
    webhookClientKeyResolver?: WebhookClientKeyResolver;
  }>,
): Promise<Hono<AppEnv>> {
  const logger = input.logger ?? consoleLogger;
  const app = new Hono<AppEnv>();

  app.use('*', requestContextMiddleware(input.createRequestId));
  app.use('*', defensiveHeadersMiddleware);
  app.use('*', requestLoggingMiddleware(logger));

  app.get('/health', context => context.json({ status: 'ok' }));
  registerWebhookRoutes(app, {
    config: input.config,
    ...(input.integrationConfig ? { integrationConfig: input.integrationConfig } : {}),
    store: input.store,
    logger,
    ...(input.nowMs ? { nowMs: input.nowMs } : {}),
    ...(input.webhookRateLimiter ? { rateLimiter: input.webhookRateLimiter } : {}),
    ...(input.webhookClientKeyResolver ? { resolveClient: input.webhookClientKeyResolver } : {}),
  });

  app.use(
    '/api/*',
    bodyLimit({
      maxSize: input.config.mastraMaxBodyBytes,
      onError: context => errorResponse(context, 'PAYLOAD_TOO_LARGE', 413, false, logger),
    }),
  );

  const appMastra = input.mastraInstance ?? (await import('./mastra/index.js')).mastra;
  const approvalConfig = input.approvalConfig ?? readApprovalConfig();
  const dashboardConfig = input.dashboardConfig ?? readDashboardConfig();
  const approvalWorkflow = (appMastra.getWorkflow as (id: string) => unknown)(
    'securityIncidentWorkflow',
  ) as ApprovalWorkflow;
  const reconcileApprovalRun = createWorkflowApprovalRunReconciler(approvalWorkflow);
  if (
    approvalConfig.localApprovalsEnabled &&
    approvalConfig.localApprovalSecret &&
    approvalConfig.approvalResumeSecret
  ) {
    registerApprovalRoutes(app, {
      config: approvalConfig,
      store: input.store,
      logger,
      authenticator: new LocalDecisionAuthenticator({
        mode: approvalConfig.mode,
        enabled: approvalConfig.localApprovalsEnabled,
        secret: approvalConfig.localApprovalSecret,
        ...(input.nowMs ? { nowMs: input.nowMs } : {}),
      }),
      reconcileApprovalRun,
    });
  }
  registerDashboardRoutes(app, {
    store: input.store,
    logger,
    config: dashboardConfig,
    approvalConfig,
    sessionClient: createWorkosDashboardSessionClient(dashboardConfig),
    reconcileApprovalRun,
    authMutationMaxBodyBytes: input.config.mastraMaxBodyBytes,
    ...(input.nowMs ? { nowMs: input.nowMs } : {}),
  });

  const exposeLocalApi =
    input.config.mode === 'local' && (!input.integrationConfig || !hasEnabledIntegration(input.integrationConfig));
  if (!exposeLocalApi) {
    // Dashboard routes authenticate and scope each request. The generic Mastra
    // control plane has no domain tenant authorization and stays local only.
    app.all('/api/*', context => errorResponse(context, 'AUTHENTICATION_REQUIRED', 401, false, logger));
  }

  if (exposeLocalApi) {
    const server = new MastraServer({
      app,
      mastra: appMastra,
      bodyLimitOptions: {
        maxSize: input.config.mastraMaxBodyBytes,
        onError: () => ({
          code: 'PAYLOAD_TOO_LARGE',
          message: 'The request body is too large.',
          retryable: false,
        }),
      },
    });
    await server.init();
  }

  app.notFound(context =>
    context.json(
      {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        requestId: context.get('requestId'),
        retryable: false,
      },
      404,
    ),
  );
  app.onError((_, context) => {
    logger.write({
      event: 'http.request.rejected',
      requestId: context.get('requestId'),
      correlationId: context.get('correlationId'),
      errorCode: 'INTERNAL_ERROR',
      status: 500,
    });
    return context.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred.',
        requestId: context.get('requestId'),
        retryable: false,
      },
      500,
    );
  });

  return app;
}
