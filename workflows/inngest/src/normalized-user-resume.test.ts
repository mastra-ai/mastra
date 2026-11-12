import { serve as serveHono } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_NORMALIZED_USER_KEY, RequestContext } from '@mastra/core/request-context';
import { DefaultStorage } from '@mastra/libsql';
import { execa } from 'execa';
import type { ResultPromise } from 'execa';
import { Hono } from 'hono';
import { Inngest } from 'inngest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ensureInngestCliBinary } from './__tests__/inngest-cli';
import { init, serve as inngestServe } from './index';

/**
 * A resumed run must take the authenticated user, roles and permissions from the
 * request doing the resuming, never from the snapshot of the request that started
 * the run. Matches `packages/core/src/workflows/normalized-user-resume.test.ts` for
 * the default and evented engines. Runs against a real inngest-cli dev server
 * because the resume context travels through the durable event payload.
 */

const DEV_SERVER_PORT = 4220;
const HANDLER_PORT = 4221;
const APP_ID = 'normalized-user-resume';
const WORKFLOW_ID = 'normalized-user-resume-wf';

const looseObject = z.looseObject({});
const alice = { id: 'alice', role: 'admin' };
const bob = { id: 'bob', role: 'member' };

// Keys the server auth middleware sets for an authenticated request.
const USER_KEYS = [
  MASTRA_NORMALIZED_USER_KEY,
  'mastra__user',
  'mastra__userRoles',
  'mastra__userPermissions',
  // The server auth middleware also writes these unprefixed aliases.
  'user',
  'userRoles',
  'userPermissions',
];

function contextFor(user: { id: string; role: string }) {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_NORMALIZED_USER_KEY, user);
  requestContext.set('mastra__user', { sub: user.id });
  requestContext.set('mastra__userRoles', [user.role]);
  requestContext.set('mastra__userPermissions', [`${user.role}:*`]);
  requestContext.set('user', { sub: user.id });
  requestContext.set('userRoles', [user.role]);
  requestContext.set('userPermissions', [`${user.role}:*`]);
  requestContext.set('tenant', 'acme');
  return requestContext;
}

function userKeysFor(user: { id: string; role: string } | undefined) {
  return {
    [MASTRA_NORMALIZED_USER_KEY]: user,
    mastra__user: user && { sub: user.id },
    mastra__userRoles: user && [user.role],
    mastra__userPermissions: user && [`${user.role}:*`],
    user: user && { sub: user.id },
    userRoles: user && [user.role],
    userPermissions: user && [`${user.role}:*`],
  };
}

function snapshotOf(requestContext: RequestContext) {
  return {
    user: Object.fromEntries(USER_KEYS.map(key => [key, requestContext.get(key)])),
    tenant: requestContext.get('tenant'),
  };
}

// Keyed by run id: Inngest replays step bodies, and both tests share the workflow.
const seen = new Map<string, { first?: ReturnType<typeof snapshotOf>; approval?: ReturnType<typeof snapshotOf> }>();

function buildWorkflow(inngest: Inngest) {
  const { createWorkflow, createStep } = init(inngest);
  const first = createStep({
    id: 'first',
    inputSchema: looseObject,
    outputSchema: looseObject,
    execute: async ({ requestContext, runId }) => {
      seen.set(runId, { ...seen.get(runId), first: snapshotOf(requestContext) });
      return {};
    },
  });
  const approval = createStep({
    id: 'approval',
    inputSchema: looseObject,
    outputSchema: looseObject,
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ requestContext, resumeData, suspend, runId }) => {
      if (!resumeData) return suspend({});
      seen.set(runId, { ...seen.get(runId), approval: snapshotOf(requestContext) });
      return {};
    },
  });
  return createWorkflow({ id: WORKFLOW_ID, inputSchema: looseObject, outputSchema: looseObject })
    .then(first)
    .then(approval)
    .commit();
}

async function waitForFunctionRegistration(fnId: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${DEV_SERVER_PORT}/dev`);
      const data = await response.json();
      const fns = (data.functions ?? []) as Array<{ slug?: string; id?: string; name?: string }>;
      const candidates = fns.flatMap(f => [f.slug, f.id, f.name].filter(Boolean) as string[]);
      if (candidates.some(c => c === fnId || c.endsWith(`-${fnId}`) || c.endsWith(`.${fnId}`))) return;
      if (i === Math.floor(maxAttempts / 3)) {
        // Re-trigger registration mid-wait in case the first PUT raced startup.
        await fetch(`http://localhost:${HANDLER_PORT}/inngest/api`, { method: 'PUT' }).catch(() => {});
      }
    } catch {
      // Keep trying.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for function registration: ${fnId}`);
}

let devServer: ResultPromise | null = null;
let handlerServer: ServerType | null = null;
let workflow!: ReturnType<typeof buildWorkflow>;

beforeAll(async () => {
  const inngest = new Inngest({ id: APP_ID, baseUrl: `http://localhost:${DEV_SERVER_PORT}` });
  workflow = buildWorkflow(inngest);

  const mastra = new Mastra({
    logger: false,
    storage: new DefaultStorage({ id: 'normalized-user-resume-storage', url: ':memory:' }),
    workflows: { [WORKFLOW_ID]: workflow } as any,
  });

  // Start the handler server first so the dev server can sync with it.
  const app = new Hono();
  const inngestHandler = inngestServe({ mastra, inngest });
  app.use('/inngest/api', async c => inngestHandler(c));
  handlerServer = serveHono({ fetch: app.fetch, port: HANDLER_PORT });

  let devServerAlreadyRunning = false;
  try {
    const response = await fetch(`http://localhost:${DEV_SERVER_PORT}/dev`, { signal: AbortSignal.timeout(1000) });
    devServerAlreadyRunning = response.ok;
  } catch {
    // Not running yet.
  }

  if (!devServerAlreadyRunning) {
    devServer = execa(
      ensureInngestCliBinary(),
      [
        'dev',
        '-p',
        String(DEV_SERVER_PORT),
        '-u',
        `http://localhost:${HANDLER_PORT}/inngest/api`,
        '--poll-interval=1',
        '--retry-interval=1',
      ],
      { cwd: import.meta.dirname, stdio: 'ignore', reject: false },
    );
    for (let i = 0; i < 60; i++) {
      try {
        const response = await fetch(`http://localhost:${DEV_SERVER_PORT}/dev`);
        if (response.ok) break;
      } catch {
        // Keep trying.
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  await fetch(`http://localhost:${HANDLER_PORT}/inngest/api`, { method: 'PUT' }).catch(() => {});
  await waitForFunctionRegistration(`workflow.${WORKFLOW_ID}`);
}, 120_000);

afterAll(async () => {
  handlerServer?.close();
  handlerServer = null;
  if (devServer) {
    devServer.kill();
    devServer = null;
  }
});

describe('Inngest engine resume with a normalized user', () => {
  it('does not carry the starting user, roles or permissions into a resume without one', async () => {
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {}, requestContext: contextFor(alice) })).status).toBe('suspended');

    const resumed = await run.resume({ step: 'approval', resumeData: { approved: true } });

    expect(resumed.status).toBe('success');
    expect(seen.get(run.runId)?.first).toEqual({ user: userKeysFor(alice), tenant: 'acme' });
    expect(seen.get(run.runId)?.approval).toEqual({ user: userKeysFor(undefined), tenant: 'acme' });
  });

  it('uses the resuming user', async () => {
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {}, requestContext: contextFor(alice) })).status).toBe('suspended');

    const resumed = await run.resume({
      step: 'approval',
      resumeData: { approved: true },
      requestContext: contextFor(bob),
    });

    expect(resumed.status).toBe('success');
    expect(seen.get(run.runId)?.approval).toEqual({ user: userKeysFor(bob), tenant: 'acme' });
  });
});
