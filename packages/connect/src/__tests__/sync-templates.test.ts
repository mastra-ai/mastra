import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEMPLATE_PIN_OVERRIDES, TEMPLATE_REPO, TEMPLATE_SHA, templatePinFor } from '../../scripts/templates-config.js';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
vi.mock('node:fs', () => ({ existsSync: vi.fn(() => true), mkdirSync: vi.fn() }));

const originalArgv = process.argv;

afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('template pins', () => {
  it('falls back to the shared upstream pin', () => {
    expect(templatePinFor()).toEqual({ repo: TEMPLATE_REPO, sha: TEMPLATE_SHA });
    expect(templatePinFor('openai')).toEqual({ repo: TEMPLATE_REPO, sha: TEMPLATE_SHA });
    expect(templatePinFor('constructor')).toEqual({ repo: TEMPLATE_REPO, sha: TEMPLATE_SHA });
  });

  it('uses the provider override while its templates are under review', () => {
    for (const [providerId, pin] of Object.entries(TEMPLATE_PIN_OVERRIDES)) {
      expect(templatePinFor(providerId)).toEqual(pin);
      expect(pin.sha).toMatch(/^[0-9a-f]{40}$/);
    }
  });
});

describe('template source pin changes', () => {
  it('syncs a provider override from its own repository and commit', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const [providerId, pin] = Object.entries(TEMPLATE_PIN_OVERRIDES)[0]!;
    process.argv = [...originalArgv.slice(0, 2), providerId];
    vi.mocked(execFileSync).mockReset().mockReturnValue('old-template-sha');
    await import('../../scripts/sync-templates.js');
    const commands = vi.mocked(execFileSync).mock.calls.map(call => call[1]);
    expect(commands).toEqual([
      ['remote', 'set-url', 'origin', `https://github.com/${pin.repo}.git`],
      ['rev-parse', 'HEAD'],
      ['fetch', '--depth', '1', 'origin', pin.sha],
      ['checkout', '--quiet', pin.sha],
    ]);
  });

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
