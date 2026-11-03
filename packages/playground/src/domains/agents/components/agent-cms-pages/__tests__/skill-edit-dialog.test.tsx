import type { ListStoredWorkspacesResponse, WorkspaceInfoResponse } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { SkillEditDialog } from '../skill-edit-dialog';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const storedWorkspaces = {
  workspaces: [{ id: 'dyn-ws', name: 'Dynamic workspace', status: 'published' }],
  total: 1,
  page: 0,
  perPage: 100,
  hasMore: false,
} as unknown as ListStoredWorkspacesResponse;

const dynamicWorkspaceInfo: WorkspaceInfoResponse = {
  isWorkspaceConfigured: true,
  id: 'dyn-ws',
  name: 'Dynamic workspace',
  capabilities: {
    hasFilesystem: true,
    hasDynamicFilesystem: true,
    hasSandbox: false,
    canBM25: false,
    canVector: false,
    canHybrid: false,
    hasSkills: true,
  },
};

const useDialogHandlers = () => {
  const requests = { workspaceInfo: 0 };
  server.use(
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
    http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () =>
      HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
    ),
    http.get(`${TEST_BASE_URL}/api/stored/workspaces`, () => HttpResponse.json(storedWorkspaces)),
    http.get(`${TEST_BASE_URL}/api/workspaces/dyn-ws`, () => {
      requests.workspaceInfo++;
      return HttpResponse.json(dynamicWorkspaceInfo);
    }),
  );
  return requests;
};

describe('SkillEditDialog', () => {
  describe('when the selected workspace resolves its filesystem per request', () => {
    it('warns admins that the skill will be saved to the database only', async () => {
      const requests = useDialogHandlers();

      renderWithProviders(<SkillEditDialog isOpen onClose={() => {}} isAdmin />);
      // The dialog resets its form once the workspace list loads, so wait until the workspace is selected.
      await waitFor(() => expect(requests.workspaceInfo).toBeGreaterThan(0));

      fireEvent.click(await screen.findByText('or fill in manually'));

      expect(await screen.findByText(/resolves its filesystem per request/)).not.toBeNull();
    });
  });
});
