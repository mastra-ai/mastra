import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { useBuilderAgentAccess } from '../use-builder-agent-access';
import { useBuilderSettings } from '@/domains/agent-builder/hooks/use-builder-settings';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

vi.mock('@/domains/auth/hooks/use-permissions', () => ({
  usePermissions: vi.fn(),
}));

vi.mock('@/domains/agent-builder/hooks/use-builder-settings', () => ({
  useBuilderSettings: vi.fn(),
}));

/** Helper to build a usePermissions mock with sensible defaults */
function mockPermissions(
  overrides: {
    rbacEnabled?: boolean;
    permissions?: string[];
  } = {},
) {
  const { rbacEnabled = true, permissions = [] } = overrides;

  const hasPermission = (p: string) => permissions.includes(p) || permissions.includes('*');
  const hasAnyPermission = (ps: string[]) => ps.some(p => hasPermission(p));
  const hasAllPermissions = (ps: string[]) => ps.every(p => hasPermission(p));

  (usePermissions as Mock).mockReturnValue({
    rbacEnabled,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  });
}

function mockSettings(
  overrides: {
    data?: Record<string, unknown> | null;
    isLoading?: boolean;
    error?: Error | null;
  } = {},
) {
  (useBuilderSettings as Mock).mockReturnValue({
    data: overrides.data ?? null,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
  });
}

describe('useBuilderAgentAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns permission-denied when user has neither read nor write', () => {
    mockPermissions({ rbacEnabled: true, permissions: [] });
    mockSettings();

    const result = useBuilderAgentAccess();

    expect(useBuilderSettings).toHaveBeenCalledWith({ enabled: false });
    expect(result.denialReason).toBe('permission-denied');
    expect(result.canAccessAgentBuilder).toBe(false);
    expect(result.hasRequiredPermissions).toBe(false);
    expect(result.isLoading).toBe(false);
  });

  it('grants access with read-only (operator role)', () => {
    mockPermissions({ rbacEnabled: true, permissions: ['stored-agents:read'] });
    mockSettings({
      data: { enabled: true, features: { agent: { tools: true } } },
    });

    const result = useBuilderAgentAccess();

    expect(useBuilderSettings).toHaveBeenCalledWith({ enabled: true });
    expect(result.denialReason).toBeNull();
    expect(result.canAccessAgentBuilder).toBe(true);
    expect(result.hasRequiredPermissions).toBe(true);
    // Read-only: can execute but not write
    expect(result.canWrite).toBe(false);
    expect(result.canExecute).toBe(true);
  });

  it('grants full access with both read and write (member role)', () => {
    mockPermissions({
      rbacEnabled: true,
      permissions: ['stored-agents:read', 'stored-agents:write', 'stored-skills:read'],
    });
    mockSettings({
      data: { enabled: true, features: { agent: { tools: true } } },
    });

    const result = useBuilderAgentAccess();

    expect(result.canAccessAgentBuilder).toBe(true);
    expect(result.canWrite).toBe(true);
    expect(result.canExecute).toBe(true);
    expect(result.canManageSkills).toBe(true);
    expect(result.canUseFavorites).toBe(true);
  });

  it('returns not-configured when builder is disabled', () => {
    mockPermissions({ rbacEnabled: false });
    mockSettings({
      data: { enabled: false, features: { agent: { tools: true } } },
    });

    const result = useBuilderAgentAccess();

    expect(result.denialReason).toBe('not-configured');
    expect(result.isBuilderEnabled).toBe(false);
    expect(result.canAccessAgentBuilder).toBe(false);
  });

  it('returns not-configured when agent feature is missing', () => {
    mockPermissions({ rbacEnabled: false });
    mockSettings({
      data: { enabled: true, features: {} },
    });

    const result = useBuilderAgentAccess();

    expect(result.denialReason).toBe('not-configured');
    expect(result.hasAgentFeature).toBe(false);
    expect(result.canAccessAgentBuilder).toBe(false);
  });

  it('returns error when settings fetch fails', () => {
    mockPermissions({ rbacEnabled: false });
    const error = new Error('Failed to fetch');
    mockSettings({ error });

    const result = useBuilderAgentAccess();

    expect(result.denialReason).toBe('error');
    expect(result.error).toBe(error);
    expect(result.canAccessAgentBuilder).toBe(false);
  });

  it('returns access and features when all checks pass', () => {
    mockPermissions({
      rbacEnabled: true,
      permissions: ['stored-agents:read', 'stored-agents:write'],
    });
    mockSettings({
      data: {
        enabled: true,
        features: { agent: { tools: true, memory: true, skills: false } },
      },
    });

    const result = useBuilderAgentAccess();

    expect(result.canAccessAgentBuilder).toBe(true);
    expect(result.denialReason).toBeNull();
    expect(result.isBuilderEnabled).toBe(true);
    expect(result.hasAgentFeature).toBe(true);
    expect(result.hasRequiredPermissions).toBe(true);
    expect(result.agentFeatures).toEqual({ tools: true, memory: true, skills: false });
  });

  it('bypasses permission checks when rbac is disabled', () => {
    mockPermissions({ rbacEnabled: false });
    mockSettings({
      data: { enabled: true, features: { agent: { agents: true } } },
    });

    const result = useBuilderAgentAccess();

    expect(useBuilderSettings).toHaveBeenCalledWith({ enabled: true });
    expect(result.hasRequiredPermissions).toBe(true);
    expect(result.canAccessAgentBuilder).toBe(true);
    expect(result.denialReason).toBeNull();
    // All granular flags true when rbac disabled
    expect(result.canWrite).toBe(true);
    expect(result.canExecute).toBe(true);
    expect(result.canManageSkills).toBe(true);
    expect(result.canUseFavorites).toBe(true);
  });

  it('returns loading only when the settings query is enabled', () => {
    // rbac enabled + no read permission → settings query disabled → not loading
    mockPermissions({ rbacEnabled: true, permissions: [] });
    mockSettings({ isLoading: true });

    const denied = useBuilderAgentAccess();
    expect(denied.isLoading).toBe(false);

    // rbac enabled + has read → settings query enabled → loading
    mockPermissions({ rbacEnabled: true, permissions: ['stored-agents:read'] });
    mockSettings({ isLoading: true });

    const loading = useBuilderAgentAccess();
    expect(loading.isLoading).toBe(true);
  });

  it('returns granular flags based on specific permissions', () => {
    // User has read + skills but NOT write — can use favorites (derived from read access)
    mockPermissions({
      rbacEnabled: true,
      permissions: ['stored-agents:read', 'stored-skills:read'],
    });
    mockSettings({
      data: { enabled: true, features: { agent: { tools: true } } },
    });

    const result = useBuilderAgentAccess();

    expect(result.canAccessAgentBuilder).toBe(true);
    expect(result.canWrite).toBe(false);
    expect(result.canExecute).toBe(true);
    expect(result.canManageSkills).toBe(true);
    expect(result.canUseFavorites).toBe(true);
  });

  it('denies favorites when user has no read access to agents or skills', () => {
    // User has only write (unusual but tests the boundary)
    mockPermissions({
      rbacEnabled: true,
      permissions: ['stored-agents:write'],
    });
    mockSettings({
      data: { enabled: true, features: { agent: { tools: true } } },
    });

    const result = useBuilderAgentAccess();

    expect(result.canUseFavorites).toBe(false);
  });
});
