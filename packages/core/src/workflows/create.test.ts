import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createWorkflow, createEventedWorkflow, cloneWorkflow } from './create';
import { createStep, Workflow } from './workflow';

/**
 * Tests for the workflow factory module (create.ts).
 *
 * This module was extracted from workflow.ts to break an ESM init-time cycle.
 * The factories route to the base `Workflow` class or the evented engine
 * based on the presence of a `schedule` property.
 */

const noop = createStep({
  id: 'noop',
  inputSchema: z.object({ v: z.number() }),
  outputSchema: z.object({ v: z.number() }),
  execute: async ({ inputData }) => inputData,
});

describe('createWorkflow', () => {
  it('returns a base Workflow when no schedule is provided', () => {
    const wf = createWorkflow({
      id: 'basic-wf',
      inputSchema: z.object({ v: z.number() }),
      outputSchema: z.object({ v: z.number() }),
    });

    expect(wf).toBeInstanceOf(Workflow);
    expect(wf.id).toBe('basic-wf');
    expect(wf.engineType).toBe('default');
  });

  it('returns an evented Workflow when schedule is provided', () => {
    const wf = createWorkflow({
      id: 'scheduled-wf',
      inputSchema: z.object({ v: z.number() }),
      outputSchema: z.object({ v: z.number() }),
      schedule: { cron: '0 * * * *' },
    });

    expect(wf.id).toBe('scheduled-wf');
    expect(wf.engineType).toBe('evented');
  });

  it('allows chaining .then() and .commit()', () => {
    const wf = createWorkflow({
      id: 'chainable-wf',
      inputSchema: z.object({ v: z.number() }),
      outputSchema: z.object({ v: z.number() }),
    })
      .then(noop)
      .commit();

    expect(wf.committed).toBe(true);
  });
});

describe('createEventedWorkflow', () => {
  it('always returns an evented Workflow even without schedule', () => {
    const wf = createEventedWorkflow({
      id: 'forced-evented',
      inputSchema: z.object({ v: z.number() }),
      outputSchema: z.object({ v: z.number() }),
    });

    expect(wf.id).toBe('forced-evented');
    expect(wf.engineType).toBe('evented');
  });
});

describe('cloneWorkflow', () => {
  it('creates a clone with a new id but same structure', () => {
    const original = createWorkflow({
      id: 'original-wf',
      inputSchema: z.object({ v: z.number() }),
      outputSchema: z.object({ v: z.number() }),
    })
      .then(noop)
      .commit();

    const clone = cloneWorkflow(original, { id: 'cloned-wf' });

    expect(clone.id).toBe('cloned-wf');
    expect(clone.committed).toBe(true);
    // Clone should have the same step definitions
    expect(clone.stepDefs).toEqual(original.stepDefs);
  });

  it('clone is independent from the original', () => {
    const original = createWorkflow({
      id: 'orig',
      inputSchema: z.object({ v: z.number() }),
      outputSchema: z.object({ v: z.number() }),
    })
      .then(noop)
      .commit();

    const clone = cloneWorkflow(original, { id: 'copy' });

    expect(clone.id).not.toBe(original.id);
    expect(clone).not.toBe(original);
  });
});
