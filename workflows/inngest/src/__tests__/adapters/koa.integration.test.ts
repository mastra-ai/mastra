import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import type { Server } from 'node:http';
import { serve as koaAdapter } from 'inngest/koa';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServe } from '../../index';
import { createTestWorkflow, HANDLER_PORT, resetInngest } from './_utils';

describe('Koa adapter integration', () => {
  let server: Server;
  const { workflow, mastra, inngest } = createTestWorkflow('koa');

  beforeAll(async () => {
    const app = new Koa();
    const router = new Router();

    // Body parsing middleware required for Inngest
    app.use(bodyParser());

    const handler = createServe(koaAdapter)({ mastra, inngest });
    router.all('/inngest/api', handler);

    app.use(router.routes());
    app.use(router.allowedMethods());

    server = app.listen(HANDLER_PORT);

    await resetInngest();
  }, 30000);

  afterAll(() => {
    server?.close();
  });

  it('should execute workflow successfully via Koa', async () => {
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { input: 'koa-test' } });

    expect(result.steps['step1']).toMatchObject({
      status: 'success',
      output: { value: 'koa-test-step1' },
    });

    expect(result.steps['step2']).toMatchObject({
      status: 'success',
      output: { result: 'koa-test-step1-step2' },
    });
  }, 60000);
});
