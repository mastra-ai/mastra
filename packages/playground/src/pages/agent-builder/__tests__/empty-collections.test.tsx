import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { authDisabledCapabilities, currentUser } from '../agents/__tests__/fixtures/auth';
import AgentBuilderFavoritePage from '../favorite';
import AgentBuilderLibraryPage from '../library';
import { emptyStoredAgents } from './fixtures/stored-agents';
import { buildBuilderSettings } from '@/domains/agent-builder/hooks/__tests__/fixtures/builder-settings';
import { emptyStoredSkills } from '@/domains/agent-builder/hooks/__tests__/fixtures/stored-skills';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

describe.each([
  { name: 'Favorites', Page: AgentBuilderFavoritePage, prefix: 'favorite' },
  { name: 'Library', Page: AgentBuilderLibraryPage, prefix: 'public' },
])('$name empty collections', ({ Page, prefix }) => {
  describe('when agents and skills are empty', () => {
    it('keeps collection guidance when switching tabs and filtering an empty collection', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
        http.get(`${TEST_BASE_URL}/api/auth/me`, () => HttpResponse.json(currentUser)),
        http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(buildBuilderSettings())),
        http.get(`${TEST_BASE_URL}/api/stored/agents`, () => HttpResponse.json(emptyStoredAgents)),
        http.get(`${TEST_BASE_URL}/api/stored/skills`, () => HttpResponse.json(emptyStoredSkills)),
      );
      const { queryClient } = renderWithProviders(
        <TestLinkProvider>
          <TooltipProvider>
            <Page />
          </TooltipProvider>
        </TestLinkProvider>,
        { router: true },
      );

      expect(await screen.findByRole('heading', { name: `No ${prefix} agents yet` })).toBeTruthy();
      fireEvent.click(await screen.findByRole('button', { name: 'Skills', exact: true }));
      expect(await screen.findByRole('heading', { name: `No ${prefix} skills yet` })).toBeTruthy();
      fireEvent.change(screen.getByPlaceholderText('Filter by name or description'), { target: { value: 'missing' } });
      expect(screen.queryByText('No skills match your search')).toBeNull();
      expect(screen.getByRole('heading', { name: `No ${prefix} skills yet` })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Agents', exact: true }));
      expect(await screen.findByRole('heading', { name: `No ${prefix} agents yet` })).toBeTruthy();
      await waitForMutationsIdle(queryClient);
    });
  });
});
