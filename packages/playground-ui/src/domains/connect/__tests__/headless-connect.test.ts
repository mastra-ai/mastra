import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  headlessAuthFieldKey,
  headlessAuthFields,
  isHeadlessAuthFieldVisible,
  splitHeadlessAuthValues,
  startHeadlessAuth,
  supportsHeadlessAuth,
} from '../headless-connect';
import type { UserConnectAuthField } from '../types';

const nangoMocks = vi.hoisted(() => ({
  auth: vi.fn((..._args: unknown[]) => Promise.resolve()),
  create: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));

vi.mock('@nangohq/frontend', async importOriginal => {
  const actual = await importOriginal<typeof import('@nangohq/frontend')>();
  class MockNango {
    win = { close: vi.fn() };
    auth(...args: unknown[]) {
      return nangoMocks.auth(...args);
    }
    create(...args: unknown[]) {
      return nangoMocks.create(...args);
    }
  }
  return { ...actual, default: MockNango as unknown as typeof actual.default };
});

const subdomainField: UserConnectAuthField = {
  name: 'subdomain',
  target: 'params',
  label: 'Subdomain',
  required: true,
  order: 0,
};

describe('supportsHeadlessAuth', () => {
  it.each([
    'OAUTH1',
    'OAUTH2',
    'MCP_OAUTH2',
    'MCP_OAUTH2_GENERIC',
    'APP',
    'CUSTOM',
    'API_KEY',
    'BASIC',
    'OAUTH2_CC',
    'NONE',
  ])('supports %s', authType => {
    expect(supportsHeadlessAuth(authType)).toBe(true);
  });

  it.each(['TBA', 'JWT', 'INSTALL_PLUGIN', null, undefined])('keeps %s on the hosted Connect UI', authType => {
    expect(supportsHeadlessAuth(authType)).toBe(false);
  });
});

describe('headlessAuthFields', () => {
  it('fills in every property of sparse catalog fields', () => {
    expect(
      headlessAuthFields({ authType: 'OAUTH2', authFields: [{ name: 'workspace', format: 'not-a-format' }] }),
    ).toEqual([
      {
        name: 'workspace',
        target: 'credentials',
        label: 'workspace',
        description: null,
        placeholder: null,
        defaultValue: null,
        format: null,
        pattern: null,
        options: null,
        prefix: null,
        suffix: null,
        documentationUrl: null,
        warnings: {},
        visibleWhen: null,
        secret: false,
        required: false,
        order: 0,
      },
    ]);
  });

  it('keeps rich catalog metadata', () => {
    const field: UserConnectAuthField = {
      name: 'region',
      target: 'params',
      label: 'Region',
      format: 'hostname',
      options: ['us', 'eu'],
      warnings: { eu: 'EU data residency' },
      visibleWhen: { field: 'mode', equals: 'cloud' },
      required: true,
      order: 3,
    };
    expect(headlessAuthFields({ authType: 'OAUTH2', authFields: [field] })).toEqual([
      expect.objectContaining({
        format: 'hostname',
        options: ['us', 'eu'],
        warnings: { eu: 'EU data residency' },
        visibleWhen: { field: 'mode', equals: 'cloud' },
        order: 3,
      }),
    ]);
  });

  it('falls back to client ID and secret fields for OAuth client credentials', () => {
    expect(headlessAuthFields({ authType: 'OAUTH2_CC', authFields: [] })).toEqual([
      expect.objectContaining({ name: 'client_id', target: 'credentials', secret: false, required: true }),
      expect.objectContaining({ name: 'client_secret', target: 'credentials', secret: true, required: true }),
    ]);
  });

  it('keeps the built-in credential fields when the catalog only lists connection params', () => {
    expect(headlessAuthFields({ authType: 'BASIC', authFields: [subdomainField] })).toEqual([
      expect.objectContaining({ name: 'subdomain', target: 'params', order: 0 }),
      expect.objectContaining({ name: 'username', target: 'credentials', order: 1 }),
      expect.objectContaining({ name: 'password', target: 'credentials', order: 2 }),
    ]);
  });

  it('does not add built-in fields when the catalog already lists credentials', () => {
    const token: UserConnectAuthField = { name: 'apiKey', target: 'credentials', label: 'Token', required: true };
    expect(headlessAuthFields({ authType: 'API_KEY', authFields: [token] })).toEqual([
      expect.objectContaining({ name: 'apiKey', label: 'Token' }),
    ]);
  });

  it('treats catalog fields without a target as credentials', () => {
    const legacy: UserConnectAuthField = { name: 'apiKey', label: 'Token', required: true };
    expect(headlessAuthFields({ authType: 'API_KEY', authFields: [legacy] })).toEqual([
      expect.objectContaining({ name: 'apiKey', target: 'credentials' }),
    ]);
  });

  it('collects nothing for providers without authentication', () => {
    expect(headlessAuthFields({ authType: 'NONE', authFields: [] })).toEqual([]);
  });
});

describe('splitHeadlessAuthValues', () => {
  const subdomain: UserConnectAuthField = { name: 'subdomain', target: 'params', required: true };
  const apiKey: UserConnectAuthField = {
    name: 'apiKey',
    target: 'credentials',
    visibleWhen: { field: 'region', equals: 'eu' },
    required: true,
  };
  const fields: UserConnectAuthField[] = [subdomain, apiKey, { name: 'region', target: 'params' }];
  const values = { 'params:subdomain': 'acme', 'credentials:apiKey': 'secret', 'params:region': 'eu' };

  it('separates credentials from connection parameters', () => {
    expect(headlessAuthFieldKey(subdomain)).toBe('params:subdomain');
    expect(isHeadlessAuthFieldVisible(fields, apiKey, values)).toBe(true);
    expect(splitHeadlessAuthValues(fields, values)).toEqual({
      credentials: { apiKey: 'secret' },
      params: { subdomain: 'acme', region: 'eu' },
    });
  });

  it('drops values for fields hidden by visibleWhen', () => {
    const usValues = { ...values, 'params:region': 'us' };
    expect(isHeadlessAuthFieldVisible(fields, apiKey, usValues)).toBe(false);
    expect(splitHeadlessAuthValues(fields, usValues)).toEqual({ params: { subdomain: 'acme', region: 'us' } });
  });

  it('hides a field whose controlling field does not exist', () => {
    const orphan: UserConnectAuthField = { name: 'token', visibleWhen: { field: 'missing', equals: 'x' } };
    expect(isHeadlessAuthFieldVisible([orphan], orphan, {})).toBe(false);
  });
});

describe('startHeadlessAuth', () => {
  beforeEach(() => {
    nangoMocks.auth.mockClear();
    nangoMocks.create.mockClear();
  });

  it('passes OAuth client credentials to nango.auth', async () => {
    await startHeadlessAuth({
      sessionToken: 'session-token',
      integrationId: 'some-cc-api',
      authType: 'OAUTH2_CC',
      credentials: { client_id: 'id', client_secret: 'secret' },
    }).result;

    expect(nangoMocks.auth).toHaveBeenCalledWith('some-cc-api', {
      credentials: { client_id: 'id', client_secret: 'secret' },
    });
  });

  it('creates unauthenticated connections directly instead of opening an OAuth popup', async () => {
    await startHeadlessAuth({ sessionToken: 'session-token', integrationId: 'public-api', authType: 'NONE' }).result;

    expect(nangoMocks.create).toHaveBeenCalledWith('public-api', {});
    expect(nangoMocks.auth).not.toHaveBeenCalled();
  });

  it('passes connection params when creating an unauthenticated connection', async () => {
    await startHeadlessAuth({
      sessionToken: 'session-token',
      integrationId: 'public-api',
      authType: 'NONE',
      params: { subdomain: 'acme' },
    }).result;

    expect(nangoMocks.create).toHaveBeenCalledWith('public-api', { params: { subdomain: 'acme' } });
  });

  it('opens the provider popup for OAuth', async () => {
    await startHeadlessAuth({ sessionToken: 'session-token', integrationId: 'github', authType: 'OAUTH2' }).result;

    expect(nangoMocks.auth).toHaveBeenCalledWith('github', { detectClosedAuthWindow: true });
  });
});
