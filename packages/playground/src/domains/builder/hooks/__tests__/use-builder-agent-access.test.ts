import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock the dependencies before importing the hook
vi.mock('@/domains/auth/hooks/use-permissions', () => ({
  usePermissions: vi.fn(),
}));

vi.mock('../use-builder-settings', () => ({
  useBuilderSettings: vi.fn(),
}));

import { useBuilderAgentAccess } from '../use-builder-agent-access';
import { useBuilderSettings } from '../use-builder-settings';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

describe('useBuilderAgentAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('permission checks', () => {
    it('returns permission-denied when missing agents:read', () => {
      (usePermissions as Mock).mockReturnValue({
        rbacEnabled: true,
        hasAllPermissions: (perms: string[]) => {
          // Has stored-agents:write but not agents:read
          if (perms.includes('agents:read')) return false;
          return true;
        },
      });

      (useBuilderSettings as Mock).mockReturnValue({
        data: { enabled: true, features: { agent: { tools: true } } },
        isLoading: false,
        error: null,
      });

      const result = useBuilderAgentAccess();

      expect(result.denialReason).toBe('permission-denied');
      expect(result.canAccessAgentBuilder).toBe(false);
      expect(result.hasRequiredPermissions).toBe(false);
    });

    it('returns permission-denied when missing stored-agents:write', () => {
      (usePermissions as Mock).mockReturnValue({
        rbacEnabled: true,
        hasAllPermissions: (perms: string[]) => {
          // Has agents:read but not stored-agents:write
          if (perms.includes('stored-agents:write')) return false;
          return true;
        },
      });

      (useBuilderSettings as Mock).mockReturnValue({
        data: { enabled: true, features: { agent: { tools: true } } },
        isLoading: false,
        error: null,
      });

      const result = useBuilderAgentAccess();

      expect(result.denialReason).toBe('permission-denied');
      expect(result.canAccessAgentBuilder).toBe(false);
      expect(result.hasRequiredPermissions).toBe(false);
    });

    it('skips settings fetch when missing agents:read permission', () => {
      (usePermissions as Mock).mockReturnValue({
        rbacEnabled: true,
        hasAllPermissions: (perms: string[]) => {
          if (perms.includes('agents:read')) return false;
          return true;
        },
      });

      (useBuilderSettings as Mock).mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      useBuilderAgentAccess();

      // Check that useBuilderSettings was called with enabled: false
      expect(useBuilderSettings).toHaveBeenCalledWith({ enabled: false });
    });

    it('bypasses permission checks when RBAC is disabled', () => {
      (usePermissions as Mock).mockReturnValue({
        rbacEnabled: false,
        hasAllPermissions: () => true, // Always returns true when RBAC disabled
      });

      (useBuilderSettings as Mock).mockReturnValue({
        data: { enabled: true, features: { agent: { tools: true } } },
        isLoading: false,
        error: null,
      });

      const result = useBuilderAgentAccess();

      expect(result.hasRequiredPermissions).toBe(true);
      expect(result.canAccessAgentBuilder).toBe(true);
      expect(result.denialReason).toBeNull();
    });
  });

  describe('builder state checks', () => {
    it('returns not-configured when builder.enabled is false', () => {
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

    it('returns not-configured when features.agent is undefined', () => {
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

    it('returns error denial reason on settings fetch error', () => {
      (usePermissions as Mock).mockReturnValue({
        rbacEnabled: false,
        hasAllPermissions: () => true,
      });

      (useBuilderSettings as Mock).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch'),
      });

      const result = useBuilderAgentAccess();

      expect(result.denialReason).toBe('error');
      expect(result.error).toBeInstanceOf(Error);
      expect(result.canAccessAgentBuilder).toBe(false);
    });
  });

  describe('success cases', () => {
    it('returns canAccessAgentBuilder: true when all checks pass', () => {
      (usePermissions as Mock).mockReturnValue({
        rbacEnabled: true,
        hasAllPermissions: () => true,
      });

      (useBuilderSettings as Mock).mockReturnValue({
        data: {
          enabled: true,
          features: { agent: { tools: true, memory: true } },
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
      expect(result.agentFeatures).toEqual({ tools: true, memory: true });
    });

    it('returns agentFeatures from builder config', () => {
      (usePermissions as Mock).mockReturnValue({
        rbacEnabled: false,
        hasAllPermissions: () => true,
      });

      const features = { tools: true, memory: false, instructions: true };
      (useBuilderSettings as Mock).mockReturnValue({
        data: { enabled: true, features: { agent: features } },
        isLoading: false,
        error: null,
      });

      const result = useBuilderAgentAccess();

      expect(result.agentFeatures).toEqual(features);
    });
  });

  describe('loading state', () => {
    it('returns isLoading: true when settings are loading', () => {
      (usePermissions as Mock).mockReturnValue({
        rbacEnabled: false,
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

    it('returns isLoading: false when fetch is skipped due to permissions', () => {
      (usePermissions as Mock).mockReturnValue({
        rbacEnabled: true,
        hasAllPermissions: (perms: string[]) => {
          if (perms.includes('agents:read')) return false;
          return true;
        },
      });

      (useBuilderSettings as Mock).mockReturnValue({
        data: null,
        isLoading: true, // Would be loading if enabled
        error: null,
      });

      const result = useBuilderAgentAccess();

      // Should not be loading because we skipped the fetch
      expect(result.isLoading).toBe(false);
    });
  });
});
