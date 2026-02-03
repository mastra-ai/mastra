import type { Server } from 'node:http';
import express from 'express';
import { serve as expressAdapter } from 'inngest/express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServe } from '../../index';
import { createTestWorkflow, HANDLER_PORT, resetInngest } from './_utils';

describe('Express adapter integration', () => {
  let server: Server;
  const { workflow, mastra, inngest } = createTestWorkflow('express');

  beforeAll(async () => {
    const app = express();

    // Body parsing middleware required for Inngest
    app.use(express.json());

    const handler = createServe(expressAdapter)({ mastra, inngest });
    app.use('/inngest/api', handler);

    server = app.listen(HANDLER_PORT);

    await resetInngest();
  }, 30000);

  afterAll(() => {
    server?.close();
  });

  it('should execute workflow successfully via Express', async () => {
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { input: 'express-test' } });

    expect(result.steps['step1']).toMatchObject({
      status: 'success',
      output: { value: 'express-test-step1' },
    });

    expect(result.steps['step2']).toMatchObject({
      status: 'success',
      output: { result: 'express-test-step1-step2' },
    });
  }, 60000);
});
