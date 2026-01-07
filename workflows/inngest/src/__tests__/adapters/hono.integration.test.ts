import { serve as honoNodeServer } from '@hono/node-server';
import { serve as honoAdapter } from 'inngest/hono';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServe } from '../../index';
import { createTestWorkflow, HANDLER_PORT, resetInngest } from './_utils';

describe('Hono adapter integration', () => {
  let server: ReturnType<typeof honoNodeServer>;
  const { workflow, mastra, inngest } = createTestWorkflow('hono');

  beforeAll(async () => {
    const app = new Hono();

    const handler = createServe(honoAdapter)({ mastra, inngest });
    app.all('/inngest/api', c => handler(c));

    server = honoNodeServer({
      fetch: app.fetch,
      port: HANDLER_PORT,
    });

    await resetInngest();
  }, 30000);

  afterAll(() => {
    server?.close();
  });

  it('should execute workflow successfully via Hono', async () => {
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { input: 'hono-test' } });

    expect(result.steps['step1']).toMatchObject({
      status: 'success',
      output: { value: 'hono-test-step1' },
    });

    expect(result.steps['step2']).toMatchObject({
      status: 'success',
      output: { result: 'hono-test-step1-step2' },
    });
  }, 60000);
});
