import type { GetScoresScorers_Response, GetSystemPackagesResponse } from '@mastra/client-js';
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import ScorersPage from '..';
import { LinkComponentProvider } from '@/lib/framework';
import { Link } from '@/lib/link';
import { stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const scorers: GetScoresScorers_Response = {
  quality: {
    scorer: { config: { id: 'quality', description: 'Measures response quality' } },
    agentIds: [],
    agentNames: [],
    workflowIds: [],
    isRegistered: true,
    source: 'code',
  },
};

const systemPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: false,
};

const useScorers = ({
  list = scorers,
  cmsEnabled = true,
}: {
  list?: GetScoresScorers_Response;
  cmsEnabled?: boolean;
}) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(list)),
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json({ ...systemPackages, cmsEnabled })),
  );
};

const renderPage = () =>
  renderWithProviders(
    // Real react-router Link so the C shortcut's synthetic click navigates the MemoryRouter.
    <LinkComponentProvider Link={Link} navigate={() => {}} paths={stubLinkPaths}>
      <Routes>
        <Route path="/scorers" element={<ScorersPage />} />
        <Route path="/cms/scorers/create" element={<div>Create scorer page</div>} />
      </Routes>
    </LinkComponentProvider>,
    { router: { initialEntries: ['/scorers'] } },
  );

describe('Scorers page', () => {
  describe('when the CMS is available', () => {
    it('shows a New scorer link to the create page in the header slot', async () => {
      useScorers({});
      renderPage();

      const link = await screen.findByRole('link', { name: 'New scorer' });
      expect(link.getAttribute('href')).toBe('/cms/scorers/create');
    });

    it('still shows the New scorer link when there are no scorers', async () => {
      useScorers({ list: {} });
      renderPage();

      expect(await screen.findByText('No Scorers yet')).not.toBeNull();
      expect(await screen.findByRole('link', { name: 'New scorer' })).not.toBeNull();
    });

    it('navigates to the create page when pressing C', async () => {
      useScorers({});
      renderPage();

      await screen.findByRole('link', { name: 'New scorer' });
      fireEvent.keyDown(window, { key: 'c' });

      expect(await screen.findByText('Create scorer page')).not.toBeNull();
    });
  });

  describe('when the CMS is not available', () => {
    it('does not show the New scorer link', async () => {
      useScorers({ cmsEnabled: false });
      const { queryClient } = renderPage();

      await screen.findByText('quality');
      await waitForMutationsIdle(queryClient);

      expect(screen.queryByRole('link', { name: 'New scorer' })).toBeNull();
    });
  });
});
