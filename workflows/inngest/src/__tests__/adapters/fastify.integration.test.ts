import Fastify from 'fastify';
import { serve as fastifyAdapter } from 'inngest/fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServe } from '../../index';
import { createTestWorkflow, HANDLER_PORT, resetInngest } from './_utils';

describe('Fastify adapter integration', () => {
  const fastify = Fastify();
  const { workflow, mastra, inngest } = createTestWorkflow('fastify');

  beforeAll(async () => {
    const handler = createServe(fastifyAdapter)({ mastra, inngest });

    fastify.route({
      method: ['GET', 'POST', 'PUT'],
      url: '/inngest/api',
      handler,
    });

    await fastify.listen({ port: HANDLER_PORT });

    await resetInngest();
  }, 30000);

  afterAll(async () => {
    await fastify.close();
  });

  it('should execute workflow successfully via Fastify', async () => {
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { input: 'fastify-test' } });

    expect(result.steps['step1']).toMatchObject({
      status: 'success',
      output: { value: 'fastify-test-step1' },
    });

    expect(result.steps['step2']).toMatchObject({
      status: 'success',
      output: { result: 'fastify-test-step1-step2' },
    });
  }, 60000);
});
