import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalSandboxProvider } from './sandbox-local-provider.js';
import { repoDirName } from './sandbox-provider.js';
import { RailwaySandboxProvider } from './sandbox-railway-provider.js';

/**
 * The shipped `WebSandboxProvider` implementations. Getter behavior through
 * the seeded registry is covered in `github/sandbox.test.ts`; these specs pin
 * the providers' own contracts: enablement, workdir layout, and create()
 * producing a sandbox that honors reattach ids.
 */

const ORIGINAL_RAILWAY_TOKEN = process.env.RAILWAY_API_TOKEN;

beforeEach(() => {
  delete process.env.RAILWAY_API_TOKEN;
});

afterEach(() => {
  if (ORIGINAL_RAILWAY_TOKEN === undefined) delete process.env.RAILWAY_API_TOKEN;
  else process.env.RAILWAY_API_TOKEN = ORIGINAL_RAILWAY_TOKEN;
});

describe('repoDirName', () => {
  it('takes the repo segment of an owner/name full name', () => {
    expect(repoDirName('acme/widgets')).toBe('widgets');
  });

  it('falls back to "repo" for an empty name', () => {
    expect(repoDirName('')).toBe('repo');
  });
});

describe('RailwaySandboxProvider', () => {
  it('is enabled with a constructor token', () => {
    expect(new RailwaySandboxProvider({ token: 'rw-token' }).isEnabled()).toBe(true);
  });

  it('is enabled via the Railway SDK env fallback', () => {
    process.env.RAILWAY_API_TOKEN = 'rw-env-token';
    expect(new RailwaySandboxProvider().isEnabled()).toBe(true);
  });

  it('is disabled without any token', () => {
    expect(new RailwaySandboxProvider().isEnabled()).toBe(false);
  });

  it('computes the workdir under /workspace by default', () => {
    expect(new RailwaySandboxProvider({ token: 't' }).workdirFor('acme/widgets')).toBe('/workspace/widgets');
  });

  it('honors a custom workdir base and strips trailing slashes', () => {
    const provider = new RailwaySandboxProvider({ token: 't', workdirBase: '/srv/checkouts/' });
    expect(provider.workdirFor('acme/widgets')).toBe('/srv/checkouts/widgets');
  });

  it('uses the base as-is when it already ends with the repo name', () => {
    const provider = new RailwaySandboxProvider({ token: 't', workdirBase: '/workspace/widgets' });
    expect(provider.workdirFor('acme/widgets')).toBe('/workspace/widgets');
  });

  it('exposes the configured budget/GC knobs', () => {
    const provider = new RailwaySandboxProvider({ token: 't', idleMinutes: 45, maxSandboxes: 3 });
    expect(provider.kind).toBe('railway');
    expect(provider.idleMinutes).toBe(45);
    expect(provider.maxSandboxes).toBe(3);
  });
});

describe('LocalSandboxProvider', () => {
  it('is always enabled', () => {
    expect(new LocalSandboxProvider().isEnabled()).toBe(true);
  });

  it('defaults the checkout root to ~/.mastracode/web/sandboxes', () => {
    const provider = new LocalSandboxProvider();
    expect(provider.workdirFor('acme/widgets')).toBe(
      join(homedir(), '.mastracode', 'web', 'sandboxes', 'acme', 'widgets'),
    );
  });

  it('honors a custom root and strips trailing slashes', () => {
    const provider = new LocalSandboxProvider({ root: '/tmp/mc-sandboxes/' });
    expect(provider.workdirFor('acme/widgets')).toBe('/tmp/mc-sandboxes/acme/widgets');
  });

  it('keeps same-name repos from different owners on distinct checkouts', () => {
    const provider = new LocalSandboxProvider({ root: '/tmp/mc-sandboxes' });
    expect(provider.workdirFor('acme/api')).not.toBe(provider.workdirFor('other/api'));
  });

  it('sanitizes path-hostile owner/name segments', () => {
    const provider = new LocalSandboxProvider({ root: '/tmp/mc-sandboxes' });
    expect(provider.workdirFor('../etc/passwd')).toBe('/tmp/mc-sandboxes/repo/etc');
    expect(provider.workdirFor('ow ner/re;po')).toBe('/tmp/mc-sandboxes/ow-ner/re-po');
  });

  it('creates sandboxes with a stable root-keyed id', () => {
    const provider = new LocalSandboxProvider({ root: '/tmp/mc-sandboxes' });
    expect(provider.create({}).id).toBe('local:/tmp/mc-sandboxes');
  });

  it('reattaches by provider sandbox id', () => {
    const provider = new LocalSandboxProvider({ root: '/tmp/mc-sandboxes' });
    expect(provider.create({ providerSandboxId: 'local:/tmp/mc-sandboxes' }).id).toBe('local:/tmp/mc-sandboxes');
  });

  it('exposes the configured budget/GC knobs', () => {
    const provider = new LocalSandboxProvider({ idleMinutes: 10, maxSandboxes: 2 });
    expect(provider.kind).toBe('local');
    expect(provider.idleMinutes).toBe(10);
    expect(provider.maxSandboxes).toBe(2);
  });
});
