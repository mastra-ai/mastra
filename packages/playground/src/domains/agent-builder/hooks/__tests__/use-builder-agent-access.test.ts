import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { useBuilderAgentAccess } from '../use-builder-agent-access';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useBuilderSettings } from '@/domains/builder/hooks/use-builder-settings';

vi.mock('@/domains/auth/hooks/use-permissions', () => ({
  usePermissions: vi.fn(),
}));

vi.mock('@/domains/builder/hooks/use-builder-settings', () => ({
  useBuilderSettings: vi.fn(),
}));

describe('useBuilderAgentAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns permission-denied when missing stored-agents:read', () => {
    (usePermissions as Mock).mockReturnValue({
      rbacEnabled: true,
      hasAllPermissions: (permissions: string[]) => !permissions.includes('stored-agents:read'),
    });

    (useBuilderSettings as Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    const result = useBuilderAgentAccess();

    expect(useBuilderSettings).toHaveBeenCalledWith({ enabled: false });
    expect(result.denialReason).toBe('permission-denied');
    expect(result.canAccessAgentBuilder).toBe(false);
    expect(result.hasRequiredPermissions).toBe(false);
    expect(result.isLoading).toBe(false);
  });

  it('returns permission-denied when missing stored-agents:write', () => {
    (usePermissions as Mock).mockReturnValue({
      rbacEnabled: true,
      hasAllPermissions: (permissions: string[]) => !permissions.includes('stored-agents:write'),
    });

    (useBuilderSettings as Mock).mockReturnValue({
      data: { enabled: true, features: { agent: { tools: true } } },
      isLoading: false,
      error: null,
    });

    const result = useBuilderAgentAccess();

    expect(useBuilderSettings).toHaveBeenCalledWith({ enabled: true });
    expect(result.denialReason).toBe('permission-denied');
    expect(result.canAccessAgentBuilder).toBe(false);
    expect(result.hasRequiredPermissions).toBe(false);
  });

  it('returns not-configured when builder is disabled', () => {
    (usePermissions as Mock).mockReturnValue({
      rbacEnabled: false,
      hasAllPermissions: () => true,
    });

    (useBuilderSettings as Mock).mockReturnValue({
      data: { enabled: false, features: { agent: { tools: true } } },
      isLoading: false,
      error: null,
    });

    const result = useBuilderAgentAccess();

    expect(result.denialReason).toBe('not-configured');
    expect(result.isBuilderEnabled).toBe(false);
    expect(result.canAccessAgentBuilder).toBe(false);
  });

  it('returns not-configured when agent feature is missing', () => {
    (usePermissions as Mock).mockReturnValue({
      rbacEnabled: false,
      hasAllPermissions: () => true,
    });

    (useBuilderSettings as Mock).mockReturnValue({
      data: { enabled: true, features: {} },
      isLoading: false,
      error: null,
    });

    const result = useBuilderAgentAccess();

    expect(result.denialReason).toBe('not-configured');
    expect(result.hasAgentFeature).toBe(false);
    expect(result.canAccessAgentBuilder).toBe(false);
  });

  it('returns error when settings fetch fails', () => {
    (usePermissions as Mock).mockReturnValue({
      rbacEnabled: false,
      hasAllPermissions: () => true,
    });

    const error = new Error('Failed to fetch');
    (useBuilderSettings as Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error,
    });

    const result = useBuilderAgentAccess();

    expect(result.denialReason).toBe('error');
    expect(result.error).toBe(error);
    expect(result.canAccessAgentBuilder).toBe(false);
  });

  it('returns access and features when all checks pass', () => {
    (usePermissions as Mock).mockReturnValue({
      rbacEnabled: true,
      hasAllPermissions: () => true,
    });

    (useBuilderSettings as Mock).mockReturnValue({
      data: {
        enabled: true,
        features: { agent: { tools: true, memory: true, skills: false } },
      },
      isLoading: false,
      error: null,
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
    (usePermissions as Mock).mockReturnValue({
      rbacEnabled: false,
      hasAllPermissions: () => false,
    });

    (useBuilderSettings as Mock).mockReturnValue({
      data: { enabled: true, features: { agent: { agents: true } } },
      isLoading: false,
      error: null,
    });

    const result = useBuilderAgentAccess();

    expect(useBuilderSettings).toHaveBeenCalledWith({ enabled: true });
    expect(result.hasRequiredPermissions).toBe(true);
    expect(result.canAccessAgentBuilder).toBe(true);
    expect(result.denialReason).toBeNull();
  });

  it('returns loading only when the settings query is enabled', () => {
    (usePermissions as Mock).mockReturnValue({
      rbacEnabled: true,
      hasAllPermissions: () => true,
    });

    (useBuilderSettings as Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    const result = useBuilderAgentAccess();

    expect(result.isLoading).toBe(true);
  });
});
