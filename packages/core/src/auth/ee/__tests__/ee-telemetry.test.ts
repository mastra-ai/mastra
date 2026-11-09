import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../../request-context';
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

  it('emits FGA feature usage for trusted actor bypasses', async () => {
    const fgaProvider = createMockFGAProvider();
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-1');

    await checkFGA({
      fgaProvider,
      user: undefined,
      resource: { type: 'workflow', id: 'nightly-workflow' },
      permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
      requestContext,
      actor: { actorKind: 'system', sourceWorkflow: 'nightly-workflow' },
    });

    expect(fgaProvider.require).not.toHaveBeenCalled();
    expect(captureEEEvent).toHaveBeenCalledWith(
      'ee_feature_used',
      expect.any(String),
      expect.objectContaining({
        feature: 'fga',
        actor_kind: 'system',
        resource_type: 'workflow',
        resource_id: 'nightly-workflow',
        permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
        user_id: null,
        organization_membership_id: null,
        source_workflow: 'nightly-workflow',
      }),
    );
  });

  it('uses metadata sourceWorkflow when a trusted actor omits one', async () => {
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-1');

    await checkFGA({
      fgaProvider: createMockFGAProvider(),
      user: undefined,
      resource: { type: 'workflow', id: 'nightly-workflow' },
      permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
      requestContext,
      actor: { actorKind: 'system' },
      context: {
        metadata: {
          sourceWorkflow: 'metadata-workflow',
        },
      },
    });

    expect(captureEEEvent).toHaveBeenCalledWith(
      'ee_feature_used',
      expect.any(String),
      expect.objectContaining({
        actor_kind: 'system',
        source_workflow: 'metadata-workflow',
      }),
    );
  });
});
