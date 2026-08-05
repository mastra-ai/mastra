import { describe, expect, it } from 'vitest';

import { buildToolGuidance } from './tool-guidance.js';

describe('buildToolGuidance task tools', () => {
  it('does not reference denied task patch tools from task_write guidance', () => {
    const guidance = buildToolGuidance('build', {
      deniedTools: new Set(['task_update', 'task_complete', 'task_check']),
    });

    expect(guidance).toContain('Use task_write with the full task list');
    expect(guidance).not.toContain('task_update');
    expect(guidance).not.toContain('task_complete');
    expect(guidance).not.toContain('task_check');
  });

  it('does not reference task_write when only patch tools are available', () => {
    const guidance = buildToolGuidance('build', {
      deniedTools: new Set(['task_write']),
    });

    expect(guidance).toContain('task_update');
    expect(guidance).toContain('task_complete');
    expect(guidance).not.toContain('task_write');
  });
});
