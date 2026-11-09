import { describe, expect, it } from 'vitest';
import { WORKSPACE_TOOLS } from './index.js';
import type { WorkspaceToolName } from './index.js';

describe('WorkspaceToolName', () => {
  it('includes every Computer lifecycle tool', () => {
    const names: WorkspaceToolName[] = Object.values(WORKSPACE_TOOLS.COMPUTER_LIFECYCLE);
    expect(names).toEqual(Object.values(WORKSPACE_TOOLS.COMPUTER_LIFECYCLE));
  });
});
