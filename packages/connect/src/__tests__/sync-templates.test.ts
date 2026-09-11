import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEMPLATE_REPO, TEMPLATE_SHA } from '../../scripts/templates-config.js';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
vi.mock('node:fs', () => ({ existsSync: vi.fn(() => true), mkdirSync: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('template source pin changes', () => {
  it('updates an existing cache remote even when the commit already matches', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(execFileSync).mockReset().mockReturnValue(TEMPLATE_SHA);
    await import('../../scripts/sync-templates.js');
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['remote', 'set-url', 'origin', `https://github.com/${TEMPLATE_REPO}.git`],
      expect.anything(),
    );
    expect(vi.mocked(execFileSync).mock.calls.some(call => call[1]?.[0] === 'fetch')).toBe(false);
  });

  it('fetches the pinned revision from the updated remote when the cache differs', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(execFileSync).mockReset().mockReturnValue('old-template-sha');
    await import('../../scripts/sync-templates.js');
    const commands = vi.mocked(execFileSync).mock.calls.map(call => call[1]);
    expect(commands).toEqual([
      ['remote', 'set-url', 'origin', `https://github.com/${TEMPLATE_REPO}.git`],
      ['rev-parse', 'HEAD'],
      ['fetch', '--depth', '1', 'origin', TEMPLATE_SHA],
      ['checkout', '--quiet', TEMPLATE_SHA],
    ]);
  });
});
