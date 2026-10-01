/**
 * Mastra Code runs one process per project, and every process shares one
 * database, so one notification store. Any process's dispatcher can pick up
 * another project's notification. Before this fix each project coordinated
 * runs only inside its own socket directory, so that process saw the thread as
 * idle and started a second run on a thread that was already working in its
 * own project's process.
 *
 * These tests use the real Unix-socket pubsub with two different resources.
 */
import { mkdtempSync, rmSync } from 'node:fs';

import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { dispatchDueNotifications, InMemoryNotificationsStorage } from '@mastra/core/notifications';
import { MastraCompositeStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createSignalsPubSub } from '../signals-pubsub.js';

const AGENT_ID = 'code-agent';
const USAGE = { inputTokens: { total: 1 }, outputTokens: { total: 1 } };
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

/** Records work on the thread across both processes, so a second run anywhere reads as two in flight. */
function createWorkLog() {
  let inFlight = 0;
  let maxInFlight = 0;
  const ran: string[] = [];
  return {
    enter(what: string) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      ran.push(what);
      let left = false;
      return () => {
        if (left) return;
        left = true;
        inFlight -= 1;
      };
    },
    get inFlight() {
      return inFlight;
    },
    get maxInFlight() {
      return maxInFlight;
    },
    ran,
  };
}

type WorkLog = ReturnType<typeof createWorkLog>;

/** One Mastra Code project's process: its own resource, its own socket directory, the shared store. */
function createProject(
  name: string,
  {
    rootDir,
    resourceId,
    notifications,
    work,
  }: { rootDir: string; resourceId: string; notifications: InMemoryNotificationsStorage; work: WorkLog },
) {
  let toolRunning = 0;
  let calls = 0;
  const model = new MockLanguageModelV3({
    doStream: async ({ prompt }) => {
      const call = ++calls;
      const leave = work.enter(`${name}:model`);
      const needsTool = prompt[prompt.length - 1]?.role !== 'tool';
      leave();
      return {
        stream: convertArrayToReadableStream(
          needsTool
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: `${name}-${call}`, toolName: 'slowTool', input: '{}' },
                { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage: USAGE },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: USAGE },
              ],
        ),
      } as any;
    },
  });
  const slowTool = createTool({
    id: 'slowTool',
    description: 'Takes a while, like a shell command',
    inputSchema: z.object({}),
    execute: async () => {
      toolRunning += 1;
      const leave = work.enter(`${name}:tool`);
      try {
        await sleep(200);
        return { ok: true };
      } finally {
        toolRunning -= 1;
        leave();
      }
    },
  });

  const pubsub = createSignalsPubSub(resourceId, { rootDir });
  const agent = new Agent({ id: AGENT_ID, name: AGENT_ID, instructions: 'Test', model, tools: { slowTool } });
  const mastra = new Mastra({
    logger: false,
    agents: { [AGENT_ID]: agent },
    pubsub,
    storage: new MastraCompositeStore({ id: `${name}-storage`, domains: { notifications } }),
  });
  cleanups.push(async () => {
    await mastra.shutdown().catch(() => {});
    await pubsub.close().catch(() => {});
  });

  return {
    agent,
    /** What this process's scheduled dispatcher does on a tick. */
    dispatchTick: () => dispatchDueNotifications({ mastra, storage: notifications }),
    get toolRunning() {
      return toolRunning;
    },
  };
}

async function waitFor(predicate: () => boolean, what: string, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(5);
  }
}

async function setUp() {
  // Short root: socket paths are capped at 104 bytes on macOS.
  const rootDir = mkdtempSync('/tmp/mct-');
  cleanups.push(() => rmSync(rootDir, { recursive: true, force: true }));
  const notifications = new InMemoryNotificationsStorage();
  const work = createWorkLog();
  const ours = createProject('ours', { rootDir, resourceId: 'sentinel-aaa', notifications, work });
  const other = createProject('other', { rootDir, resourceId: 'mastra-bbb', notifications, work });
  const target = { resourceId: 'sentinel-aaa', threadId: 'sentinel-thread' };
  const memory = { resource: target.resourceId, thread: target.threadId };
  return { notifications, work, ours, other, target, memory };
}

describe('notifications shared across Mastra Code projects', () => {
  for (const claimed of [false, true]) {
    it(`another project's process never runs our active thread (${claimed ? 'thread claimed' : 'no claim'})`, async () => {
      const { notifications, work, ours, other, target, memory } = await setUp();
      if (claimed) {
        // With cross-agent signals on, Mastra Code claims every thread it loads.
        const claim = await ours.agent.claimThreadOwnership({ ...target, streamOptions: { memory } });
        expect(claim.claimed).toBe(true);
        cleanups.push(() => claim.unsubscribe());
      }

      const stream = await ours.agent.stream('go', { memory });
      void stream.consumeStream().catch(() => {});
      await waitFor(() => ours.toolRunning > 0, 'our tool call');

      // Active run: a summary goes in now, the full notification waits in the shared store.
      await ours.agent.sendNotificationSignal(
        { source: 'sentinel', kind: 'ping', priority: 'high', summary: 'ping' },
        target,
      );
      const [record] = await notifications.listNotifications({ threadId: target.threadId });
      expect(record?.status).toBe('pending');

      // The other project's dispatcher ticks while our run is still working.
      await other.dispatchTick();
      await sleep(100);
      expect(
        work.ran.filter(entry => entry.startsWith('other:')),
        "the other project's process ran our thread",
      ).toEqual([]);
      expect(work.maxInFlight, 'two runs worked on the thread at once').toBe(1);

      await waitFor(
        () => work.inFlight === 0 && ours.agent.getActiveThreadRunId(target) === undefined,
        'our run to end',
        5000,
      );
      await ours.dispatchTick();
      await waitFor(
        () => work.inFlight === 0 && ours.agent.getActiveThreadRunId(target) === undefined,
        'the thread to settle',
        5000,
      );

      const final = await notifications.getNotification({ threadId: target.threadId, id: record!.id });
      expect(final?.status).toBe('delivered');
      expect(final?.lastDeliveryError ?? undefined, 'a delivery attempt failed').toBeUndefined();
      expect(work.ran.filter(entry => entry.startsWith('other:'))).toEqual([]);
      expect(work.maxInFlight).toBe(1);
    }, 30_000);
  }
});
