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

describe('buildToolGuidance subconscious tools', () => {
  it('omits subconscious guidance when the subconscious is off', () => {
    const guidance = buildToolGuidance('build');

    expect(guidance).not.toContain('Subconscious Memory');
    expect(guidance).not.toContain('ask_memory');
    expect(guidance).not.toContain('knowledge_search');
  });

  it('explains the subconscious, the knowledge tools, and async ask_memory when enabled', () => {
    const guidance = buildToolGuidance('build', { hasSubconscious: true });

    expect(guidance).toContain('# Subconscious Memory');
    expect(guidance).toContain('**knowledge_search** / **knowledge_read** / **knowledge_browse**');
    expect(guidance).toContain('**ask_memory**');
    expect(guidance).toContain('ASYNCHRONOUS');
    expect(guidance).toContain('<remind-answer source="subconscious" agent="remind"');
    expect(guidance).toContain('moreComing="false"');
    expect(guidance).toContain('Prefer these over `recall`');
  });

  it('drops denied subconscious tools individually', () => {
    const guidance = buildToolGuidance('build', {
      hasSubconscious: true,
      deniedTools: new Set(['ask_memory', 'knowledge_browse']),
    });

    expect(guidance).toContain('# Subconscious Memory');
    expect(guidance).toContain('**knowledge_search** / **knowledge_read**');
    expect(guidance).not.toContain('knowledge_browse');
    expect(guidance).not.toContain('ask_memory');
  });

  it('does not recommend a denied recall tool from the knowledge guidance', () => {
    const guidance = buildToolGuidance('build', {
      hasSubconscious: true,
      deniedTools: new Set(['recall']),
    });

    expect(guidance).toContain('# Subconscious Memory');
    expect(guidance).not.toContain('recall');
  });

  it('omits the whole section when every subconscious tool is denied', () => {
    const guidance = buildToolGuidance('build', {
      hasSubconscious: true,
      deniedTools: new Set(['ask_memory', 'knowledge_search', 'knowledge_read', 'knowledge_browse']),
    });

    expect(guidance).not.toContain('Subconscious Memory');
  });
});
