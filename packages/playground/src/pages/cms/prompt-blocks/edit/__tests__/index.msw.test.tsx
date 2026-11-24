import type { GetSystemPackagesResponse, UpdateStoredPromptBlockParams } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import CmsPromptBlocksEditPage from '..';
import {
  cmsDisabledPackages,
  cmsEnabledPackages,
  promptBlockWithTags,
  threePromptBlockVersions,
} from './fixtures/prompt-block';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const BLOCK_URL = `${TEST_BASE_URL}/api/stored/prompt-blocks/tone-of-voice`;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

/** Serves a prompt block whose tags change when the page saves them, and records what was saved. */
const renderPage = (initialTags: Record<string, string>, packages: GetSystemPackagesResponse = cmsEnabledPackages) => {
  let versionTags = initialTags;
  const savedBodies: UpdateStoredPromptBlockParams[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(packages)),
    http.get(BLOCK_URL, () => HttpResponse.json(promptBlockWithTags(versionTags))),
    http.get(`${BLOCK_URL}/versions`, () => HttpResponse.json(threePromptBlockVersions)),
    http.patch(BLOCK_URL, async ({ request }) => {
      const body = (await request.json()) as UpdateStoredPromptBlockParams;
      savedBodies.push(body);
      versionTags = (body.metadata?.versionTags ?? versionTags) as Record<string, string>;
      return HttpResponse.json(promptBlockWithTags(versionTags));
    }),
  );
  renderWithProviders(
    <TestLinkProvider>
      <Routes>
        <Route path="/cms/prompts/:promptBlockId/edit" element={<CmsPromptBlocksEditPage />} />
      </Routes>
      <LocationProbe />
    </TestLinkProvider>,
    { router: { initialEntries: ['/cms/prompts/tone-of-voice/edit'] } },
  );
  return { savedBodies };
};

const tagsSection = () => screen.findByRole('region', { name: 'Version tags' });

describe('Prompt block edit page', () => {
  describe('when a version of the prompt block is tagged', () => {
    it('lists the tag and shows it on that version in the history', async () => {
      renderPage({ production: 'version-1' });

      expect(within(await tagsSection()).getByText('production')).not.toBeNull();
      expect(await screen.findByRole('button', { name: /^v1.*production/ })).not.toBeNull();
      expect(screen.queryByRole('button', { name: /^v3.*production/ })).toBeNull();
    });

    it('opens the tagged version from the tag list', async () => {
      renderPage({ production: 'version-1' });

      fireEvent.click(await screen.findByRole('button', { name: 'View the version tagged production' }));

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe('/cms/prompts/tone-of-voice/edit?versionId=version-1'),
      );
    });

    it('removes the tag and keeps the others', async () => {
      const { savedBodies } = renderPage({ production: 'version-1', staging: 'version-3' });

      fireEvent.click(await screen.findByRole('button', { name: 'Remove tag production' }));

      await waitFor(() => expect(savedBodies).toEqual([{ metadata: { versionTags: { staging: 'version-3' } } }]));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove tag production' })).toBeNull());
    });
  });

  describe('when tagging with no version selected', () => {
    it('saves the tag on the latest version and shows it', async () => {
      const { savedBodies } = renderPage({ staging: 'version-2' });

      fireEvent.change(await screen.findByRole('textbox', { name: 'Tag name' }), { target: { value: 'canary' } });
      fireEvent.click(screen.getByRole('button', { name: 'Tag v3' }));

      await waitFor(() =>
        expect(savedBodies).toEqual([{ metadata: { versionTags: { staging: 'version-2', canary: 'version-3' } } }]),
      );
      expect(await screen.findByRole('button', { name: 'Remove tag canary' })).not.toBeNull();
    });
  });

  describe('when the tag name is reserved', () => {
    it('explains why and does not save', async () => {
      const { savedBodies } = renderPage({});

      fireEvent.change(await screen.findByRole('textbox', { name: 'Tag name' }), { target: { value: 'draft' } });
      fireEvent.click(screen.getByRole('button', { name: 'Tag v3' }));

      expect((await screen.findByRole('alert')).textContent).toContain('reserved');
      expect(savedBodies).toEqual([]);
    });
  });

  describe('when the editor is not available', () => {
    it('lists the tags without controls to change them', async () => {
      renderPage({ production: 'version-1' }, cmsDisabledPackages);

      expect(within(await tagsSection()).getByText('production')).not.toBeNull();
      expect(screen.queryByRole('textbox', { name: 'Tag name' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remove tag production' })).toBeNull();
    });
  });
});
