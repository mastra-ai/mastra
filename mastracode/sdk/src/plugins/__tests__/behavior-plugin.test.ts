import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createMastraCodeBehaviorPlugin } from '../behavior-plugin.js';

let tempDir: string | undefined;
afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('createMastraCodeBehaviorPlugin', () => {
  it('loads a filesystem definition and returns the shared provider', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mastracode-behavior-'));
    fs.writeFileSync(
      path.join(tempDir, 'BEHAVIOR.md'),
      '---\ntools: [read_file]\n---\nInspect the current task before editing.',
    );
    const plugin = createMastraCodeBehaviorPlugin({ id: 'coding-plugin', resolver: tempDir });
    const providers = await plugin.signalProviders!({ cwd: tempDir } as never);

    expect(providers).toHaveLength(1);
    expect(providers[0]?.id).toBe('behavior-coding-plugin');
    expect(Object.keys(providers[0]?.getTools?.() ?? {})).toEqual(['behavior', 'behavior_intent']);
  });
});
