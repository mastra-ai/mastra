import type { PermissionRules } from '@mastra/client-js';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/web-ui/render';
import { useSetPermissionForCategoryMutation } from '../useAgentControllerPermissionMutations';
import { useAgentControllerPermissions } from '../useAgentControllerPermissions';

const controllerId = 'code';
const resourceId = 'resource-test';
const permissionsUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}/permissions`;
const categoryUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}/permissions/category`;

const hookArgs = { agentControllerId: controllerId, resourceId, baseUrl: TEST_BASE_URL, enabled: true };

describe('agent-controller permission hooks', () => {
  describe('when permissions are updated', () => {
    it('refreshes the cached permission rules through React Query invalidation', async () => {
      const firstRules: PermissionRules = { categories: { read: 'ask' }, tools: {} };
      const refreshedRules: PermissionRules = { categories: { read: 'allow' }, tools: {} };
      let rules = firstRules;
      const onReadPermissions = vi.fn();
      const onWritePermission = vi.fn();

      server.use(
        http.get(permissionsUrl, () => {
          onReadPermissions();
          return HttpResponse.json(rules);
        }),
        http.put(categoryUrl, async ({ request }) => {
          onWritePermission(await request.json());
          rules = refreshedRules;
          return HttpResponse.json({ ok: true });
        }),
      );

      const { result, client } = renderHookWithProviders(() => {
        const permissions = useAgentControllerPermissions(hookArgs);
        const setCategory = useSetPermissionForCategoryMutation(hookArgs);
        return { permissions, setCategory };
      });

      await waitFor(() => expect(result.current.permissions.data?.categories?.read).toBe('ask'));

      await act(async () => {
        await result.current.setCategory.mutateAsync({ category: 'read', policy: 'allow' });
      });
      await waitForMutationsIdle(client);

      await waitFor(() => expect(result.current.permissions.data?.categories?.read).toBe('allow'));
      expect(onReadPermissions).toHaveBeenCalledTimes(2);
      expect(onWritePermission).toHaveBeenCalledWith({ category: 'read', policy: 'allow' });
    });
  });
});
