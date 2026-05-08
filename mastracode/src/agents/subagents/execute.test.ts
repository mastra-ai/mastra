import { describe, expect, it } from 'vitest';

import { executeSubagent } from './execute.js';

describe('executeSubagent', () => {
  it('does not expose parent task tools to non-forked execute subagents', () => {
    expect(executeSubagent.tools).toBeUndefined();
    expect(executeSubagent.instructions).not.toContain('task_write');
    expect(executeSubagent.instructions).not.toContain('task_update');
    expect(executeSubagent.instructions).not.toContain('task_complete');
    expect(executeSubagent.instructions).not.toContain('task_check');
  });
});
