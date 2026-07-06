/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/18682
 *
 * `@mastra/core` and auth provider packages (via `@mastra/auth`) each bundle
 * their own copy of the `MastraAuthProvider`/`MastraBase` declarations. With
 * nominal brands (`#private`, `protected`) those copies were mutually
 * unassignable, so `server.auth = new MastraAuthWorkos()` failed to compile
 * in userland. These tests run against packed artifacts installed from the
 * local registry — exactly what users consume — under
 * `exactOptionalPropertyTypes: true` (see tsconfig.exact-optional.json), the
 * strict flag that surfaced the bug.
 */
import { describe, it } from 'vitest';
import { Mastra } from '@mastra/core';
import { CompositeAuth, SimpleAuth } from '@mastra/core/server';
import type { IMastraAuthProvider } from '@mastra/core/server';
import type { IMastraAuthProvider as IMastraAuthProviderFromAuth } from '@mastra/auth';
import { MastraAuthWorkos } from '@mastra/auth-workos';

declare const workos: MastraAuthWorkos;

describe('auth provider assignability across package boundaries (#18682)', () => {
  it('accepts a provider instance as server.auth', () => {
    new Mastra({
      server: {
        auth: workos,
      },
    });
  });

  it('accepts a provider instance as studio.auth', () => {
    new Mastra({
      studio: {
        auth: workos,
      },
    });
  });

  it('allows direct IMastraAuthProvider annotations', () => {
    const _provider: IMastraAuthProvider<any> = workos;
    const _providerFromAuth: IMastraAuthProviderFromAuth<any> = workos;
  });

  it('accepts provider instances in CompositeAuth', () => {
    const simple = new SimpleAuth({ tokens: { 'test-token': { sub: 'user-1' } } });
    const composite = new CompositeAuth([workos, simple]);

    new Mastra({
      server: {
        auth: composite,
      },
    });
  });
});
