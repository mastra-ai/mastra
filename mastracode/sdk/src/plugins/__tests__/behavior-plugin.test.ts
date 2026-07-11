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
      path.join(tempDir, 'behavior.yaml'),
      JSON.stringify({
        id: 'coding',
        version: '1',
        initialState: 'work',
        states: [{ id: 'work', transitions: [{ id: 'leave', target: 'exit', exit: true }] }],
      }),
    );
    const plugin = createMastraCodeBehaviorPlugin({ id: 'coding-plugin', definition: tempDir });
    const providers = await plugin.signalProviders!({ cwd: tempDir } as never);

    expect(providers).toHaveLength(1);
    expect(providers[0]?.id).toBe('behavior-coding');
    expect(Object.keys(providers[0]?.getTools?.() ?? {})).toEqual([
      'behavior_select',
      'behavior_intent',
      'behavior_transition',
      'behavior_exit',
    ]);
  });
});
