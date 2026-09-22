import { Agent } from '@mastra/core/agent';
import { Inngest } from 'inngest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createInngestAgent } from './durable-agent/create-inngest-agent';
import { createInngestDurableAgenticWorkflow } from './durable-agent/create-inngest-agentic-workflow';
import type { InngestWorkflow } from './workflow';
import { init } from './index';

// Regression coverage for #24702: function-level `retries` must be configurable so Inngest can
// re-invoke a run after a failed SDK request (e.g. process restart mid-run).

const inngest = new Inngest({ id: 'retries-config-test' });
const { createWorkflow, createStep } = init(inngest);

const step = createStep({
  id: 'noop',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async () => ({}),
});

function build(extra: { retries?: number; cron?: string } = {}) {
  return createWorkflow({
    id: `wf-${extra.retries ?? 'default'}-${extra.cron ? 'cron' : 'event'}`,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    ...extra,
  })
    .then(step)
    .commit();
}

const optsOf = (fn: unknown) => (fn as { opts: { retries?: number } }).opts;

describe('Inngest function-level retries', () => {
  it('defaults to 0 for the event-triggered function', () => {
    expect(optsOf(build().getFunction()).retries).toBe(0);
  });

  it('forwards configured retries to the event-triggered function', () => {
    expect(optsOf(build({ retries: 3 }).getFunction()).retries).toBe(3);
  });

  it('forwards retries to the cron function', () => {
    const functions = build({ retries: 3, cron: '0 * * * *' }).getFunctions();
    expect(functions).toHaveLength(2);
    for (const fn of functions) {
      expect(optsOf(fn).retries).toBe(3);
    }
  });

  it('defaults the cron function to 0', () => {
    for (const fn of build({ cron: '0 * * * *' }).getFunctions()) {
      expect(optsOf(fn).retries).toBe(0);
    }
  });

  it('forwards retries to the durable agentic loop function', () => {
    const loop = createInngestDurableAgenticWorkflow({ inngest, retries: 2 }) as InngestWorkflow;
    expect(optsOf(loop.getFunction()).retries).toBe(2);
    const functions = loop.getFunctions();
    expect(functions.length).toBeGreaterThan(1);
    for (const fn of functions) {
      expect(optsOf(fn).retries).toBe(2);
    }
    const defaultLoop = createInngestDurableAgenticWorkflow({ inngest }) as InngestWorkflow;
    expect(optsOf(defaultLoop.getFunction()).retries).toBe(0);
  });

  it('forwards retries from createInngestAgent to its loop function', () => {
    const agent = new Agent({ id: 'retries-agent', name: 'retries-agent', instructions: 'x', model: 'openai/gpt-4o' });
    const inngestAgent = createInngestAgent({ agent, inngest, retries: 4 });
    const [workflow] = inngestAgent.getDurableWorkflows() as InngestWorkflow[];
    expect(optsOf(workflow!.getFunction()).retries).toBe(4);
  });
});
