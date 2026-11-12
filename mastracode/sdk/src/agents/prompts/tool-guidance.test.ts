import path from 'node:path';

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

  it('uses the supplied plan directory in plan-mode guidance', () => {
    const guidance = buildToolGuidance('plan', { plansDir: '.artifacts/plans' });

    expect(guidance).toContain('.artifacts/plans/');
    expect(guidance).not.toContain('.mastracode/plans/');
  });

  it('uses .mastracode/plans/ by default in plan-mode guidance', () => {
    const guidance = buildToolGuidance('plan');

    expect(guidance).toContain('.mastracode/plans/');
    expect(guidance).not.toContain('.artifacts/plans/');
  });
});

describe('buildToolGuidance background work', () => {
  it.each([false, true])('describes background shells and subagents only when they are on (%s)', backgroundTools => {
    const guidance = buildToolGuidance('build', { backgroundTools });

    expect(guidance.includes('**Background work**')).toBe(backgroundTools);
    expect(guidance.includes('Do not poll')).toBe(backgroundTools);
    // The parallel-only rule would forbid the single backgrounded subagent the background guidance suggests.
    expect(guidance.includes('multiple subagents in parallel')).toBe(!backgroundTools);
  });
});

describe('buildToolGuidance knowledge tools', () => {
  it('does not advertise Subconscious or ask_memory guidance', () => {
    const guidance = buildToolGuidance('build');

    expect(guidance).not.toContain('Subconscious');
    expect(guidance).not.toContain('ask_memory');
    expect(guidance).not.toContain('knowledge_search');
  });
});

describe('buildToolGuidance plans directory outside plan mode', () => {
  // On Windows the SDK resolves the default plans dir with path.join, giving
  // `.mastracode\plans`. The guidance must still recognise that as the default.
  // Otherwise it treats it as a custom dir and tells the agent to write plans
  // under `.mastracode/plans/` and, in the same breath, never under it.
  it('does not warn against the default dir when it arrives with Windows separators', () => {
    const guidance = buildToolGuidance('build', { plansDir: path.win32.join('.mastracode', 'plans') });

    expect(guidance).toContain(
      'Write plan files under `.mastracode/plans/` (e.g. `.mastracode/plans/add-dark-mode.md`).',
    );
    expect(guidance).not.toContain('never under `.mastracode/plans/`');
  });

  it('omits plans guidance in read-only Explore mode', () => {
    expect(buildToolGuidance('build', { plansDir: '.artifacts/plans' })).toContain('Write plan files under');
    expect(buildToolGuidance('fast', { plansDir: '.artifacts/plans' })).not.toContain('Write plan files under');
  });
});
