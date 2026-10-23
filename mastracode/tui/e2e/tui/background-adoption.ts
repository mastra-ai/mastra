import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTool } from '@mastra/core/tools';
import { expect, vi } from 'vitest';
import { z } from 'zod/v3';

import type { McE2eScenario } from './types.js';

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function adoptionScenario(mode: 'deferred' | 'awaited' | 'cancel' | 'failure'): McE2eScenario {
  const awaited = mode === 'awaited' || mode === 'failure';
  let work = gate();
  let cleanup = gate();
  let events: string[] = [];
  let drain: (() => Promise<void>) | undefined;
  return {
    name: `background-adoption-${mode}`,
    description: `Exercise ${mode} adoption through the real SDK, agent loop, manager, and TUI.`,
    testName: `tracks ${mode} adopted work independently of its acknowledgement`,
    useOpenAIModel: true,
    aimockFixture: awaited ? 'background-adoption-awaited.json' : 'background-adoption.json',
    prepare({ appDataDir }) {
      const path = join(appDataDir, 'settings.json');
      const settings = JSON.parse(readFileSync(path, 'utf8'));
      settings.backgroundTools = { enabled: true };
      writeFileSync(path, JSON.stringify(settings, null, 2));
    },
    inProcessApp({ startMastraCodeApp }) {
      work = gate();
      cleanup = gate();
      events = [];
      return startMastraCodeApp({
        onCreated({ session, controller }) {
          drain = async () => {
            await vi.waitFor(() => expect(session.stream.isActive()).toBe(false), { timeout: 10_000 });
            const storage = await controller.getMastra()?.getStorage()?.getStore('workflows');
            if (!storage) throw new Error('Workflow storage missing');
            // Stream completion precedes asynchronous snapshot cleanup; drain it before closing the database.
            await vi.waitFor(
              async () => {
                expect((await storage.listWorkflowRuns({ workflowName: 'agentic-loop' })).total).toBe(0);
                expect((await storage.listWorkflowRuns({ workflowName: '__background-task' })).total).toBe(0);
              },
              { timeout: 10_000 },
            );
          };
        },
        config: {
          disableHooks: true,
          disableMcp: true,
          unixSocketPubSub: false,
          extraTools: {
            adopted_probe: createTool({
              id: 'adopted_probe',
              description: 'Adopt a gated operation, returning an acknowledgement before it finishes.',
              background: { enabled: true, maxRetries: 0 },
              inputSchema: z.object({}),
              execute: async (_input, context) => {
                if (!context?.background) throw new Error('Native adoption bridge missing');
                expect(context.background.disposition).toBe(awaited ? 'awaited' : 'deferred');
                const completion = (async () => {
                  events.push('started');
                  await work.promise;
                  events.push('cleanup');
                  await cleanup.promise;
                  if (mode === 'failure') throw new Error('ADOPTED_FAILURE');
                  events.push('completed');
                  return { marker: 'ADOPTED_RESULT' };
                })();
                context.background.adopt({
                  completion,
                  cancel: () => {
                    events.push('cancelled');
                    work.resolve();
                  },
                });
                return { marker: 'ACK_ONLY' };
              },
            }),
            parent_probe: createTool({
              id: 'parent_probe',
              description: 'Record the next parent action.',
              inputSchema: z.object({}),
              execute: async () => {
                events.push('parent-action');
                return { marker: 'PARENT_ACTION_DONE' };
              },
            }),
          },
        },
      });
    },
    async run({ terminal, runtime }) {
      runtime.startLiveOutput(terminal);
      terminal.resize(140, 80);
      await runtime.waitForScreenText(/Resource ID:/i, terminal);
      try {
        terminal.submit('Run the deterministic adoption test.');
        if (awaited) {
          await vi.waitFor(() => expect(events).toContain('started'), { timeout: 10_000 });
          expect(events).toEqual(['started']);
        } else {
          await runtime.waitForOutputText(/PARENT_DONE/, terminal, 20_000);
          expect(events).toEqual(['started', 'parent-action']);
        }
        expect(terminal.serialize().view).not.toContain('adopted_probe completed in background');
        if (!awaited) {
          terminal.write('\x07');
          await runtime.waitForScreenText(/Background activity/i, terminal);
          await runtime.waitForScreenText(/running/i, terminal);
        }
        if (mode === 'cancel') {
          terminal.write('d');
          await vi.waitFor(() => expect(events).toContain('cancelled'), { timeout: 10_000 });
          await runtime.waitForScreenText(/cancelled/i, terminal);
        } else {
          work.resolve();
        }
        await vi.waitFor(() => expect(events).toContain('cleanup'));
        expect(events).not.toContain('completed');
        if (awaited) expect(events).not.toContain('parent-action');
        else terminal.write('\x1b');
        expect(terminal.serialize().view).not.toContain('adopted_probe completed in background');
        cleanup.resolve();
        const status = mode === 'cancel' ? 'cancelled' : mode === 'failure' ? 'failed' : 'completed';
        await runtime.waitForOutputText(new RegExp(`adopted_probe ${status} in background`, 'i'), terminal, 15_000);
        if (awaited) {
          await runtime.waitForOutputText(/PARENT_DONE/, terminal, 15_000);
          expect(events.at(-1)).toBe('parent-action');
        }
        if (mode === 'cancel') {
          // Even an uncooperative operation resolving successfully after cancellation cannot win.
          await vi.waitFor(() => expect(events).toContain('completed'));
          expect(terminal.serialize().view).not.toContain('adopted_probe completed in background');
        }
        terminal.write('\x07');
        await runtime.waitForScreenText(/Background activity/i, terminal);
        await runtime.waitForScreenText(new RegExp(status, 'i'), terminal);
        terminal.write('\x1b');
      } finally {
        work.resolve();
        cleanup.resolve();
        try {
          await drain?.();
        } finally {
          terminal.keyCtrlC();
        }
      }
    },
    verifyAimockRequests(requests) {
      const serialized = JSON.stringify(requests);
      expect(serialized).toContain('PARENT_ACTION_DONE');
      expect(serialized).not.toContain('ACK_ONLY');
      if (awaited) expect(serialized).toContain(mode === 'failure' ? 'ADOPTED_FAILURE' : 'ADOPTED_RESULT');
      else expect(serialized).toContain('Background task started');
    },
  };
}

export const backgroundAdoptionDeferredScenario = adoptionScenario('deferred');
export const backgroundAdoptionAwaitedScenario = adoptionScenario('awaited');
export const backgroundAdoptionCancelScenario = adoptionScenario('cancel');
export const backgroundAdoptionFailureScenario = adoptionScenario('failure');
