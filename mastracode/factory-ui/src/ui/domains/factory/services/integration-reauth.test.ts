import { describe, expect, it } from 'vitest';
import { getIntegrationReauthInfo, isIntegrationReauthError } from './integration-reauth';
import { isLinearReauthError } from './linear';

describe('getIntegrationReauthInfo', () => {
  it('returns reauth info for integration_reauth_required errors', () => {
    const err = Object.assign(new Error('Linear authorization expired.'), {
      code: 'integration_reauth_required',
      integration: 'linear',
      connectPath: '/auth/linear/connect',
    });
    expect(getIntegrationReauthInfo(err)).toEqual({
      integration: 'linear',
      connectPath: '/auth/linear/connect',
      message: 'Linear authorization expired.',
    });
  });

  it('returns null for non-reauth errors', () => {
    expect(getIntegrationReauthInfo(new Error('something broke'))).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(getIntegrationReauthInfo(null)).toBeNull();
    expect(getIntegrationReauthInfo(undefined)).toBeNull();
  });

  it('returns null for errors with a different code', () => {
    const err = Object.assign(new Error('not found'), { code: 'not_found' });
    expect(getIntegrationReauthInfo(err)).toBeNull();
  });

  it('defaults missing fields', () => {
    const err = { code: 'integration_reauth_required' };
    const info = getIntegrationReauthInfo(err);
    expect(info).toEqual({
      integration: 'unknown',
      connectPath: '',
      message: 'Authorization expired. Reconnect to continue.',
    });
  });
});

describe('isIntegrationReauthError', () => {
  it('returns true for integration_reauth_required', () => {
    const err = Object.assign(new Error('expired'), {
      code: 'integration_reauth_required',
      integration: 'linear',
      connectPath: '/auth/linear/connect',
    });
    expect(isIntegrationReauthError(err)).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isIntegrationReauthError(new Error('boom'))).toBe(false);
  });
});

describe('isLinearReauthError backward compat', () => {
  it('matches the new integration_reauth_required code for linear', () => {
    const err = Object.assign(new Error('expired'), {
      code: 'integration_reauth_required',
      integration: 'linear',
      connectPath: '/auth/linear/connect',
    });
    expect(isLinearReauthError(err)).toBe(true);
  });

  it('matches the legacy linear_reauth_required code', () => {
    const err = Object.assign(new Error('expired'), { code: 'linear_reauth_required' });
    expect(isLinearReauthError(err)).toBe(true);
  });

  it('does not match integration_reauth_required for other integrations', () => {
    const err = Object.assign(new Error('expired'), {
      code: 'integration_reauth_required',
      integration: 'slack',
    });
    expect(isLinearReauthError(err)).toBe(false);
  });

  it('does not match other errors', () => {
    expect(isLinearReauthError(new Error('boom'))).toBe(false);
  });
});
