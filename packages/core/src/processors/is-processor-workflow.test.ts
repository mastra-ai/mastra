/**
 * Tests for packages/core/src/processors/is-processor-workflow.ts
 *
 * `isProcessorWorkflow` is a pure type guard with no I/O and no async
 * behaviour. Coverage focuses on the documented contract: it must match
 * workflow-shaped objects (id/inputSchema/outputSchema/execute) while
 * explicitly excluding anything that also looks like a processor (which
 * has process*-prefixed methods).
 */
import { describe, expect, it } from 'vitest';

import { isProcessorWorkflow } from './is-processor-workflow';

function buildWorkflowLike(overrides: Record<string, unknown> = {}) {
  return {
    id: 'my-workflow',
    inputSchema: {},
    outputSchema: {},
    execute: () => {},
    ...overrides,
  };
}

describe('isProcessorWorkflow', () => {
  it('returns true for a minimal object matching the workflow shape', () => {
    expect(isProcessorWorkflow(buildWorkflowLike())).toBe(true);
  });

  it('returns false when id is missing', () => {
    const obj = buildWorkflowLike();
    delete (obj as any).id;

    expect(isProcessorWorkflow(obj)).toBe(false);
  });

  it('returns false when id is present but not a string', () => {
    expect(isProcessorWorkflow(buildWorkflowLike({ id: 123 }))).toBe(false);
  });

  it('returns false when inputSchema is missing', () => {
    const obj = buildWorkflowLike();
    delete (obj as any).inputSchema;

    expect(isProcessorWorkflow(obj)).toBe(false);
  });

  it('returns false when outputSchema is missing', () => {
    const obj = buildWorkflowLike();
    delete (obj as any).outputSchema;

    expect(isProcessorWorkflow(obj)).toBe(false);
  });

  it('returns false when execute is missing', () => {
    const obj = buildWorkflowLike();
    delete (obj as any).execute;

    expect(isProcessorWorkflow(obj)).toBe(false);
  });

  it('returns false when execute is present but not a function', () => {
    expect(isProcessorWorkflow(buildWorkflowLike({ execute: 'not-a-function' }))).toBe(false);
  });

  it('returns false when the object also has a processInput method', () => {
    expect(isProcessorWorkflow(buildWorkflowLike({ processInput: () => {} }))).toBe(false);
  });

  it('returns false when the object also has a processInputStep method', () => {
    expect(isProcessorWorkflow(buildWorkflowLike({ processInputStep: () => {} }))).toBe(false);
  });

  it('returns false when the object also has a processOutputStream method', () => {
    expect(isProcessorWorkflow(buildWorkflowLike({ processOutputStream: () => {} }))).toBe(false);
  });

  it('returns false when the object also has a processOutputResult method', () => {
    expect(isProcessorWorkflow(buildWorkflowLike({ processOutputResult: () => {} }))).toBe(false);
  });

  it('returns false when the object also has a processOutputStep method', () => {
    expect(isProcessorWorkflow(buildWorkflowLike({ processOutputStep: () => {} }))).toBe(false);
  });

  it('returns false when the object also has a processLLMRequest method', () => {
    expect(isProcessorWorkflow(buildWorkflowLike({ processLLMRequest: () => {} }))).toBe(false);
  });

  it('returns false when the object also has a processAPIError method', () => {
    expect(isProcessorWorkflow(buildWorkflowLike({ processAPIError: () => {} }))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isProcessorWorkflow(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isProcessorWorkflow(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isProcessorWorkflow('a string')).toBe(false);
    expect(isProcessorWorkflow(42)).toBe(false);
    expect(isProcessorWorkflow(true)).toBe(false);
  });

  it('returns false for an empty object', () => {
    expect(isProcessorWorkflow({})).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isProcessorWorkflow([])).toBe(false);
  });

  it('ignores extra unrelated properties on an otherwise-valid workflow', () => {
    expect(isProcessorWorkflow(buildWorkflowLike({ description: 'does a thing', retryConfig: { attempts: 3 } }))).toBe(
      true,
    );
  });
});
