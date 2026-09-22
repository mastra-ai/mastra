/**
 * Function-level `retries` against a real Inngest dev server.
 *
 * Inngest applies the function's `retries` to every step.run() that throws, so
 * step-code failures must stay non-retriable to Inngest: a failing step runs
 * exactly `step.retries + 1` times regardless of the function-level value.
 * Function-level retries still recover failed requests to the app. That is
 * simulated by dropping the handler's connections mid-step within one process,
 * not by restarting it.
 */
import { createServer } from 'node:net';
import type { ServerType } from '@hono/node-server';
import { serve as nodeServe } from '@hono/node-server';
import { MastraNonRetryableError } from '@mastra/core/error';
import { Mastra } from '@mastra/core/mastra';
import { DefaultStorage } from '@mastra/libsql';
import { execa } from 'execa';
import type { ResultPromise } from 'execa';
import { Hono } from 'hono';
import { Inngest } from 'inngest';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ensureInngestCliBinary } from './__tests__/inngest-cli';
import { init, serve as inngestServe } from './index';

let inngestPort = 0;
let handlerPort = 0;

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

let devServer: ResultPromise | null = null;
let handlerServer: ServerType | null = null;

async function waitFor(check: () => Promise<boolean>, message: string) {
  for (let i = 0; i < 60; i++) {
    if (await check().catch(() => false)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(message);
}

async function setup(build: (helpers: ReturnType<typeof init>) => any) {
  inngestPort = await getFreePort();
  handlerPort = await getFreePort();
  const inngest = new Inngest({ id: 'function-retries-test', baseUrl: `http://localhost:${inngestPort}` });
  const workflow = build(init(inngest));
  const mastra = new Mastra({
    logger: false,
    storage: new DefaultStorage({ id: 'function-retries-storage', url: ':memory:' }),
    workflows: { [workflow.id]: workflow },
  });

  const app = new Hono();
  app.all('/inngest/api', c => inngestServe({ mastra, inngest })(c));
  handlerServer = nodeServe({ fetch: app.fetch, port: handlerPort });

  // A fresh dev server per test keeps retries from one test out of the next.
  devServer = execa(
    ensureInngestCliBinary(),
    [
      'dev',
      '-p',
      String(inngestPort),
      '-u',
      `http://localhost:${handlerPort}/inngest/api`,
      '--no-discovery',
      '--poll-interval=1',
      '--retry-interval=1',
    ],
    { stdio: 'ignore', reject: false },
  );
  await waitFor(async () => (await fetch(`http://localhost:${inngestPort}/dev`)).ok, 'dev server did not start');
  await fetch(`http://localhost:${handlerPort}/inngest/api`, { method: 'PUT' });
  await waitFor(async () => {
    const data = await (await fetch(`http://localhost:${inngestPort}/dev`)).json();
    return (data.functions ?? []).some((fn: { slug?: string }) => fn.slug?.endsWith(`workflow.${workflow.id}`));
  }, 'workflow function was not registered');

  // Wrapped because a workflow has a `.then()` step builder, so awaiting it directly never settles.
  return { workflow };
}

async function waitForRunStatus(): Promise<string> {
  let status = 'UNKNOWN';
  await waitFor(async () => {
    const response = await fetch(`http://localhost:${inngestPort}/v0/gql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          '{ runs(first:1, filter:{from:"2020-01-01T00:00:00Z"}, orderBy:[{field:QUEUED_AT,direction:DESC}]) { edges { node { status } } } }',
      }),
    });
    const data = await response.json();
    status = data?.data?.runs?.edges?.[0]?.node?.status ?? status;
    return ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
  }, 'run did not finish');
  return status;
}

afterEach(async () => {
  handlerServer?.close();
  handlerServer = null;
  devServer?.kill();
  await devServer?.catch(() => {});
  devServer = null;
  // Wait until the dev server is gone so its retries can't reach the next test.
  await waitFor(async () => {
    try {
      await fetch(`http://localhost:${inngestPort}/dev`);
      return false;
    } catch {
      return true;
    }
  }, 'dev server did not shut down');
});

describe('Inngest function-level retries', () => {
  for (const [functionRetries, stepRetries] of [
    [0, 0],
    [2, 0],
    [2, 1],
  ] as const) {
    it(`runs a failing step ${stepRetries + 1} time(s) with function retries=${functionRetries}, step retries=${stepRetries}`, async () => {
      let executions = 0;
      const { workflow } = await setup(({ createWorkflow, createStep }) => {
        const failing = createStep({
          id: 'failing',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          retries: stepRetries,
          execute: async () => {
            executions++;
            throw new Error('step code failed');
          },
        });
        return createWorkflow({
          id: `retries-fail-${functionRetries}-${stepRetries}`,
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          retries: functionRetries,
        })
          .then(failing)
          .commit();
      });

      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');
      expect(executions).toBe(stepRetries + 1);
    });
  }

  it('runs a step that throws a built-in error type once with function retries enabled', async () => {
    let executions = 0;
    const { workflow } = await setup(({ createWorkflow, createStep }) => {
      const failing = createStep({
        id: 'type-error',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => {
          executions++;
          throw new TypeError('bad input');
        },
      });
      return createWorkflow({
        id: 'retries-type-error',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retries: 2,
      })
        .then(failing)
        .commit();
    });

    const run = await workflow.createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('failed');
    expect(executions).toBe(1);
  });

  it('does not retry MastraNonRetryableError with function retries enabled', async () => {
    let executions = 0;
    const { workflow } = await setup(({ createWorkflow, createStep }) => {
      const failing = createStep({
        id: 'fatal',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retries: 3,
        execute: async () => {
          executions++;
          throw new MastraNonRetryableError('permanent failure');
        },
      });
      return createWorkflow({
        id: 'retries-non-retryable',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        retries: 2,
      })
        .then(failing)
        .commit();
    });

    const run = await workflow.createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('failed');
    expect(executions).toBe(1);
  });

  it('still recovers a run whose request is dropped mid-step, skipping completed steps', async () => {
    let firstExecutions = 0;
    let secondExecutions = 0;
    const { workflow } = await setup(({ createWorkflow, createStep }) => {
      const first = createStep({
        id: 'first',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => {
          firstExecutions++;
          return {};
        },
      });
      const second = createStep({
        id: 'second',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => {
          secondExecutions++;
          if (secondExecutions === 1) {
            // Drop the in-flight request, as a process restart would.
            handlerServer!.closeAllConnections();
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          return { ok: true };
        },
      });
      return createWorkflow({
        id: 'retries-request-failure',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        retries: 2,
      })
        .then(first)
        .then(second)
        .commit();
    });

    const run = await workflow.createRun();
    await run.startAsync({ inputData: {} });

    expect(await waitForRunStatus()).toBe('COMPLETED');
    expect(firstExecutions).toBe(1);
    expect(secondExecutions).toBe(2);
  });
});
