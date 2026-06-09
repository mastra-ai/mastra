import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type * as PosthogTelemetry from '../../../telemetry/posthog';

const { captureEEEvent } = vi.hoisted(() => ({
  captureEEEvent: vi.fn(),
}));

vi.mock('../../../telemetry/posthog', async () => {
  const actual = await vi.importActual<typeof PosthogTelemetry>('../../../telemetry/posthog');
  return {
    ...actual,
    captureEEEvent,
  };
});

import { buildCapabilities } from '../capabilities';
import { checkFGA } from '../fga-check';
import type { IFGAProvider } from '../interfaces/fga';
import { MastraFGAPermissions } from '../interfaces/permissions.generated';
import type { IRBACProvider } from '../interfaces/rbac';
import type { EEUser } from '../interfaces/user';
import { clearLicenseCache } from '../license';

function createMockAuth(user: EEUser | null) {
  return {
    getCurrentUser: vi.fn().mockResolvedValue(user),
  };
}

function createMockFGAProvider(): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(true),
    require: vi.fn().mockResolvedValue(undefined),
    filterAccessible: vi.fn().mockImplementation((_user, resources) => Promise.resolve(resources)),
  };
}

function createMockRBACProvider(): IRBACProvider<EEUser> {
  return {
    getRoles: vi.fn().mockResolvedValue(['admin']),
    hasRole: vi.fn().mockResolvedValue(true),
    getPermissions: vi.fn().mockResolvedValue(['agents:*']),
    hasPermission: vi.fn().mockResolvedValue(true),
    hasAllPermissions: vi.fn().mockResolvedValue(true),
    hasAnyPermission: vi.fn().mockResolvedValue(true),
  };
}

describe('EE telemetry', () => {
  let originalNodeEnv: string | undefined;
  let originalLicense: string | undefined;
  let originalTelemetryDisabled: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env['NODE_ENV'];
    originalLicense = process.env['MASTRA_EE_LICENSE'];
    originalTelemetryDisabled = process.env['MASTRA_TELEMETRY_DISABLED'];
    process.env['NODE_ENV'] = 'production';
    process.env['MASTRA_EE_LICENSE'] = 'license-key-that-is-long-enough-for-tests';
    delete process.env['MASTRA_TELEMETRY_DISABLED'];
    clearLicenseCache();
    captureEEEvent.mockClear();
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
    else delete process.env['NODE_ENV'];
    if (originalLicense !== undefined) process.env['MASTRA_EE_LICENSE'] = originalLicense;
    else delete process.env['MASTRA_EE_LICENSE'];
    if (originalTelemetryDisabled !== undefined) process.env['MASTRA_TELEMETRY_DISABLED'] = originalTelemetryDisabled;
    else delete process.env['MASTRA_TELEMETRY_DISABLED'];
    clearLicenseCache();
  });

  it('emits a safe license check event from capabilities', async () => {
    await buildCapabilities(
      createMockAuth({ id: 'user-1', email: 'user@test.com', name: 'User' }) as any,
      new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '203.0.113.1, 10.0.0.1',
          'user-agent': 'test-agent',
        },
      }),
      { fga: createMockFGAProvider() },
    );

    expect(captureEEEvent).toHaveBeenCalledWith(
      'ee_license_check',
      'user-1',
      expect.objectContaining({
        license_valid: true,
        license_hash: expect.any(String),
        $ip: '203.0.113.1',
        user_id: 'user-1',
        capabilities: expect.objectContaining({ fga: true }),
      }),
    );
    expect(JSON.stringify(captureEEEvent.mock.calls)).not.toContain('license-key-that-is-long-enough-for-tests');
    expect(JSON.stringify(captureEEEvent.mock.calls)).not.toContain('user@test.com');
    expect(JSON.stringify(captureEEEvent.mock.calls)).not.toContain('test-agent');
    expect(captureEEEvent.mock.calls[0]?.[2]).not.toHaveProperty('ip');
    expect(captureEEEvent.mock.calls[0]?.[2]).not.toHaveProperty('user_agent');
  });

  it('falls back to x-real-ip for license check events', async () => {
    await buildCapabilities(
      createMockAuth({ id: 'user-1', email: 'user@test.com', name: 'User' }) as any,
      new Request('http://localhost', {
        headers: {
          'x-real-ip': '198.51.100.2',
        },
      }),
    );

    expect(captureEEEvent).toHaveBeenCalledWith(
      'ee_license_check',
      'user-1',
      expect.objectContaining({
        $ip: '198.51.100.2',
      }),
    );
    expect(captureEEEvent.mock.calls[0]?.[2]).not.toHaveProperty('ip');
  });

  it('emits RBAC feature usage when access is resolved', async () => {
    await buildCapabilities(
      createMockAuth({
        id: 'user-1',
        email: 'user@test.com',
        name: 'User',
        metadata: { organizationMembershipId: 'om-1' },
      }) as any,
      new Request('http://localhost'),
      { rbac: createMockRBACProvider() },
    );

    expect(captureEEEvent).toHaveBeenCalledWith(
      'ee_feature_used',
      'user-1',
      expect.objectContaining({
        feature: 'rbac',
        role_count: 1,
        permission_count: 1,
        organization_membership_id: 'om-1',
      }),
    );
    expect(JSON.stringify(captureEEEvent.mock.calls)).not.toContain('license-key-that-is-long-enough-for-tests');
    expect(JSON.stringify(captureEEEvent.mock.calls)).not.toContain('user@test.com');
    expect(JSON.stringify(captureEEEvent.mock.calls)).not.toContain('agents:*');
  });

  it('emits FGA feature usage after successful checks', async () => {
    await checkFGA({
      fgaProvider: createMockFGAProvider(),
      user: { id: 'user-2', email: 'user2@test.com', organizationMembershipId: 'om-2' },
      resource: { type: 'agent', id: 'agent-1' },
      permission: MastraFGAPermissions.AGENTS_EXECUTE,
    });

    expect(captureEEEvent).toHaveBeenCalledWith(
      'ee_feature_used',
      'user-2',
      expect.objectContaining({
        feature: 'fga',
        resource_type: 'agent',
        resource_id: 'agent-1',
        permission: MastraFGAPermissions.AGENTS_EXECUTE,
        organization_membership_id: 'om-2',
      }),
    );
    expect(JSON.stringify(captureEEEvent.mock.calls)).not.toContain('license-key-that-is-long-enough-for-tests');
    expect(JSON.stringify(captureEEEvent.mock.calls)).not.toContain('user2@test.com');
  });

  it('does not let telemetry failures break FGA checks', async () => {
    captureEEEvent.mockImplementationOnce(() => {
      throw new Error('posthog unavailable');
    });

    await expect(
      checkFGA({
        fgaProvider: createMockFGAProvider(),
        user: { id: 'user-2' },
        resource: { type: 'agent', id: 'agent-1' },
        permission: MastraFGAPermissions.AGENTS_EXECUTE,
      }),
    ).resolves.toBeUndefined();
  });
});
