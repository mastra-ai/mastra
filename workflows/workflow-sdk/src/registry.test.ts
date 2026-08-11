import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearWorkflowRegistry,
  getRegisteredWorkflow,
  listRegisteredWorkflowIds,
  registerWorkflow,
  requireRegisteredWorkflow,
  type RegisteredMastraWorkflow,
} from './registry';

function entry(id: string): RegisteredMastraWorkflow {
  return {
    id,
    executionGraph: { id, steps: [] },
    serializedStepGraph: [],
    mastra: undefined,
    executionEngine: { options: { validateInputs: true } } as unknown as RegisteredMastraWorkflow['executionEngine'],
  };
}

describe('workflow registry', () => {
  beforeEach(() => {
    clearWorkflowRegistry();
  });

  it('round-trips a registration', () => {
    registerWorkflow(entry('alpha'));

    expect(getRegisteredWorkflow('alpha')?.id).toBe('alpha');
    expect(listRegisteredWorkflowIds()).toEqual(['alpha']);
  });

  it('lets a re-registration win, so dev-server reloads replace stale definitions', () => {
    const first = entry('alpha');
    const second = entry('alpha');
    registerWorkflow(first);
    registerWorkflow(second);

    expect(getRegisteredWorkflow('alpha')).toBe(second);
    expect(listRegisteredWorkflowIds()).toEqual(['alpha']);
  });

  it('keeps its map on globalThis so a second module copy shares it', () => {
    registerWorkflow(entry('alpha'));

    // The Workflow SDK build inlines some modules into its bundles and
    // externalizes others, so this file can legitimately be evaluated more than
    // once in one process. Anchoring the map to a well-known symbol is what
    // makes both copies agree; a module-level `Map` would give the step bundle
    // an empty registry. Reading it the way a second copy would is the only
    // honest way to assert that from a single-copy test.
    const shared = (globalThis as Record<symbol, unknown>)[Symbol.for('@mastra/workflow-sdk.registry.v1')] as
      | Map<string, RegisteredMastraWorkflow>
      | undefined;

    expect(shared).toBeInstanceOf(Map);
    expect(shared?.get('alpha')?.id).toBe('alpha');
  });

  it('names the likely fix when a workflow is missing', () => {
    registerWorkflow(entry('alpha'));

    expect(() => requireRegisteredWorkflow('beta')).toThrowError(/not registered with @mastra\/workflow/);
    // The message should point at the real cause — a missing side-effect
    // import — and list what did register, so the mismatch is obvious.
    expect(() => requireRegisteredWorkflow('beta')).toThrowError(/alpha/);
    expect(() => requireRegisteredWorkflow('beta')).toThrowError(/side effects/);
  });

  it('reports an empty registry distinctly from a wrong id', () => {
    expect(() => requireRegisteredWorkflow('beta')).toThrowError(/\(none\)/);
  });
});
