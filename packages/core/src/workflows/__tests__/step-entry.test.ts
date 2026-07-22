import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Step } from '../step';
import { getEntryComponent, getEntryDescription, getEntryId, getEntryRetries, getEntryWorkflow } from '../step-entry';
import type { SingleStepEntry } from '../types';
import { createStep } from '../workflow';

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    ...createStep({
      id: 'plain-step',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async () => ({}),
    }),
    ...overrides,
  } as Step;
}

const agentEntry = (options?: any): SingleStepEntry => ({
  type: 'agent',
  id: 'agent-entry',
  agentId: 'my-agent',
  options,
});

const toolEntry = (options?: any): SingleStepEntry => ({
  type: 'tool',
  id: 'tool-entry',
  toolId: 'my-tool',
  options,
});

const mappingEntry: SingleStepEntry = { type: 'mapping', id: 'mapping-entry', mapConfig: {} };

describe('getEntryId', () => {
  it('returns the wrapped step id for step entries', () => {
    expect(getEntryId({ type: 'step', step: makeStep() })).toBe('plain-step');
  });

  it('returns the outer id for declarative entries', () => {
    expect(getEntryId(agentEntry())).toBe('agent-entry');
    expect(getEntryId(toolEntry())).toBe('tool-entry');
    expect(getEntryId(mappingEntry)).toBe('mapping-entry');
  });
});

describe('getEntryRetries', () => {
  it('prefers the step-level retries over the fallback', () => {
    expect(getEntryRetries({ type: 'step', step: makeStep({ retries: 3 }) }, 7)).toBe(3);
  });

  it('falls back when a step declares no retries', () => {
    expect(getEntryRetries({ type: 'step', step: makeStep() }, 7)).toBe(7);
    expect(getEntryRetries({ type: 'step', step: makeStep() })).toBeUndefined();
  });

  it('prefers options.retries on agent/tool entries over the fallback (same precedence as the materialized-step path)', () => {
    // Matches today's behavior where options.retries was copied onto the
    // fabricated Step and then resolved via `step.retries ?? workflow.retries`.
    expect(getEntryRetries(agentEntry({ retries: 2 }), 7)).toBe(2);
    expect(getEntryRetries(toolEntry({ retries: 4 }), 7)).toBe(4);
  });

  it('falls back for agent/tool entries without options.retries', () => {
    expect(getEntryRetries(agentEntry(), 7)).toBe(7);
    expect(getEntryRetries(agentEntry({}), 7)).toBe(7);
    expect(getEntryRetries(toolEntry())).toBeUndefined();
  });

  it('always falls back for mapping entries', () => {
    expect(getEntryRetries(mappingEntry, 7)).toBe(7);
    expect(getEntryRetries(mappingEntry)).toBeUndefined();
  });
});

describe('getEntryComponent', () => {
  it('returns the step component for step entries', () => {
    expect(getEntryComponent({ type: 'step', step: makeStep({ component: 'WORKFLOW' } as any) })).toBe('WORKFLOW');
    expect(getEntryComponent({ type: 'step', step: makeStep() })).toBeUndefined();
  });

  it('returns undefined for declarative entries', () => {
    expect(getEntryComponent(agentEntry())).toBeUndefined();
    expect(getEntryComponent(toolEntry())).toBeUndefined();
    expect(getEntryComponent(mappingEntry)).toBeUndefined();
  });
});

describe('getEntryWorkflow', () => {
  it('returns the wrapped workflow for nested-workflow step entries', () => {
    const nested = makeStep({ component: 'WORKFLOW' } as any);
    expect(getEntryWorkflow({ type: 'step', step: nested })).toBe(nested);
  });

  it('returns null for plain step entries', () => {
    expect(getEntryWorkflow({ type: 'step', step: makeStep() })).toBeNull();
  });

  it('returns null for declarative entries', () => {
    expect(getEntryWorkflow(agentEntry())).toBeNull();
    expect(getEntryWorkflow(toolEntry())).toBeNull();
    expect(getEntryWorkflow(mappingEntry)).toBeNull();
  });
});

describe('getEntryDescription', () => {
  it('returns the step description for step entries', () => {
    expect(getEntryDescription({ type: 'step', step: makeStep({ description: 'does things' }) })).toBe('does things');
  });

  it('returns undefined for declarative entries', () => {
    expect(getEntryDescription(agentEntry())).toBeUndefined();
    expect(getEntryDescription(mappingEntry)).toBeUndefined();
  });
});
