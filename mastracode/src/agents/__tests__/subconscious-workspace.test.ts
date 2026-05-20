import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getSubconsciousWorkspacePath } from '../subconscious-workspace.js';

describe('getSubconsciousWorkspacePath', () => {
  it('stores subconscious artifacts under the user mastracode directory by resource id', () => {
    expect(getSubconsciousWorkspacePath('resource-123')).toBe(
      path.join(os.homedir(), '.mastracode', 'subconscious', 'resource-123'),
    );
  });

  it('sanitizes resource ids before using them as path segments', () => {
    expect(getSubconsciousWorkspacePath('team/project:thread')).toBe(
      path.join(os.homedir(), '.mastracode', 'subconscious', 'team_project_thread'),
    );
  });
});
