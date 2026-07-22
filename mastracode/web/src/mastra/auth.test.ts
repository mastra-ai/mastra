import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
import { MastraAuthWorkos } from '@mastra/auth-workos';
import { describe, expect, it } from 'vitest';

import { createWebAuthProvider } from './auth';

const defaults = {
  disabled: false,
  studioConfigured: false,
  workosConfigured: false,
  workosRedirectUri: undefined,
  betterAuthSecret: undefined,
  betterAuthSignUpEnabled: true,
};

describe('createWebAuthProvider', () => {
  it('disables auth before considering configured providers', () => {
    const provider = createWebAuthProvider({
      ...defaults,
      disabled: true,
      studioConfigured: true,
      workosConfigured: true,
      betterAuthSecret: 'better-auth-secret',
    });

    expect(provider).toBeNull();
  });

  it('keeps Studio auth ahead of WorkOS and Better Auth', () => {
    const provider = createWebAuthProvider({
      ...defaults,
      studioConfigured: true,
      workosConfigured: true,
      betterAuthSecret: 'better-auth-secret',
    });

    expect(provider).toBeUndefined();
  });

  it('selects WorkOS ahead of Better Auth', () => {
    const provider = createWebAuthProvider({
      ...defaults,
      workosConfigured: true,
      workosRedirectUri: 'https://factory.example.com/auth/callback',
      betterAuthSecret: 'better-auth-secret',
    });

    expect(provider).toBeInstanceOf(MastraAuthWorkos);
  });

  it('selects Better Auth when WorkOS is incomplete', () => {
    const provider = createWebAuthProvider({ ...defaults, betterAuthSecret: 'better-auth-secret' });

    expect(provider).toBeInstanceOf(MastraAuthBetterAuth);
  });

  it('leaves provider selection to the factory by default', () => {
    expect(createWebAuthProvider(defaults)).toBeUndefined();
  });
});
