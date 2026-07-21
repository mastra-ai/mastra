import { describe, expect, it } from 'vitest';
import { WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS, WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES } from './index';

describe('workflow builder authoring contract', () => {
  it('publishes the seven persisted graph entry types', () => {
    expect(WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES).toEqual([
      'agent',
      'tool',
      'mapping',
      'parallel',
      'foreach',
      'sleep',
      'sleepUntil',
    ]);
  });

  it('keeps shared composition and nesting constraints available to every authoring frontend', () => {
    expect(WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS).toContain(
      'previous output shape must satisfy the next input schema',
    );
    expect(WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS).toContain('Parallel children must be single-step');
    expect(WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS).toContain('body may only be an agent or tool');
    expect(WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS).toContain('Never invent agent or tool IDs');
  });
});
