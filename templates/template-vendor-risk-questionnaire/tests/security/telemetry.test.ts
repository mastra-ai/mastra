import { it, expect, vi } from 'vitest';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core';
import { createNativeStorage } from '../../src/mastra/persistence/database.ts';
import { TestExporter } from '@mastra/observability';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { draftingFixture, controlledProvider, jsonStream, stream } from '../support/drafting.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { defaultExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';
import { createScreening } from '../../src/mastra/processing/security.ts';
import { createLocalObservability, SafeLogger } from '../../src/mastra/observability/privacy.ts';

it('omits_blocked_payloads_from_processor_errors_callbacks_and_traces', async () => {
  const root = await temporaryDirectory();
  const blocked = 'PRIVATE_BLOCKED_PAYLOAD_CANARY',
    secret = 'sk-proj-CALLBACK_SECRET_CANARY_0123456789';
  const logs: unknown[] = [],
    callbacks: unknown[] = [];
  const spies = ['warn', 'error', 'log', 'info', 'debug'].map(name =>
    vi.spyOn(console, name as 'log').mockImplementation((...args) => {
      logs.push(args);
    }),
  );
  try {
    for (const mode of ['block', 'provider-error', 'callback-error'] as const) {
      const dir = resolve(root, mode);
      await mkdir(dir);
      const f = await draftingFixture(dir);
      const provider = controlledProvider(f, [], phase =>
        phase === 'injection'
          ? mode === 'provider-error'
            ? stream([{ type: 'error', error: new Error(secret) }])
            : jsonStream(
                mode === 'block'
                  ? { categories: [{ type: 'injection', score: 1 }], reason: blocked }
                  : { categories: null, reason: null },
              )
          : undefined,
      );
      const store = await openProcessingStore(f.url);
      await store.begin(f.runId, defaultExecutionPolicy);
      const exporter = new TestExporter(),
        observability = createLocalObservability([exporter]);
      const screen = createScreening({
        runId: f.runId,
        questionId: f.questions[0]!.id,
        policy: defaultExecutionPolicy,
        store,
        models: provider.factory,
        onDetection: event => {
          callbacks.push(event);
          if (mode === 'callback-error') throw new Error(secret);
        },
      });
      const agent = new Agent({
        id: 'native-security-proof',
        name: blocked,
        instructions: 'Run the mandatory security boundary before answering.',
        model: 'openai/gpt-6.1-sol',
        maxRetries: 0,
        inputProcessors: [
          {
            id: 'question-screening',
            processInput: async ({ messages, abort }) => {
              try {
                await screen(blocked, 'question');
              } catch {
                return abort('SECURITY_BLOCKED', {
                  metadata: { gate: 'SEC-001', reason: mode === 'block' ? 'INJECTION_BLOCKED' : 'DETECTOR_FAILED' },
                });
              }
              return messages;
            },
            onViolation: () => {
              throw new Error(secret);
            },
          },
        ],
      });
      const storage = createNativeStorage('native-proof', f.url).storage;
      await storage.init();
      const mastra = new Mastra({
        agents: { agent },
        storage,
        observability,
        logger: new SafeLogger(record => logs.push(record)),
      });
      let outcome: unknown;
      try {
        outcome = await agent.generate(blocked, { maxSteps: 1 });
      } catch (error) {
        outcome = error;
      }
      const status = (await store.status(f.runId))!;
      expect(status.security.at(-1)?.status).toBe(mode === 'block' ? 'blocked' : 'failed');
      expect(status.usage.length).toBe(provider.calls.length);
      expect(status.usage.length).toBeGreaterThan(0);
      expect(status.security.at(-1)?.reason).toBe(mode === 'block' ? 'INJECTION_BLOCKED' : 'DETECTOR_FAILED');
      await observability.flush();
      expect(exporter.getAllSpans().length).toBeGreaterThan(0);
      for (const value of [
        JSON.stringify(logs),
        JSON.stringify(callbacks),
        JSON.stringify(status.security),
        JSON.stringify(exporter.getAllSpans()),
        JSON.stringify(
          outcome instanceof Error
            ? { name: outcome.name, message: outcome.message, stack: outcome.stack }
            : (outcome as { tripwire?: unknown })?.tripwire,
        ),
      ]) {
        expect(value).not.toContain(blocked);
        expect(value).not.toContain(secret);
      }
      if (mode === 'callback-error') expect(callbacks.length).toBeGreaterThan(0);
      if (mode === 'provider-error')
        expect(status.usage.some(u => u.status === 'uncertain' && u.inputTokens === null && u.estimatedUsd > 0)).toBe(
          true,
        );
      store.close();
      await mastra.shutdown();
      const reopened = await openProcessingStore(f.url);
      expect((await reopened.status(f.runId))?.security.at(-1)?.status).toBe(mode === 'block' ? 'blocked' : 'failed');
      reopened.close();
    }
  } finally {
    spies.forEach(s => s.mockRestore());
    await cleanupDirectory(root);
  }
}, 60000);
