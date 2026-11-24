import type { Card } from '@mastra/factory/storage/domains/work-items/base';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import {
  dependabotAlertUrl,
  dependabotCard,
  detailCard,
  gitlabCard,
  vantaCard,
  vantaVulnerabilityUrl,
} from './fixtures/integrationCards';
import { nativeFactsCard } from './fixtures/providerFactsCard';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

const LAYOUTS = ['board', 'list'];

function renderBoard(card: Card, layout: string) {
  stubWorkBoard();
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [card] }),
    ),
    // The live board feed is not what these cards are about.
    http.get(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/feed-events`,
      () => new HttpResponse(null, { status: 404 }),
    ),
  );
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/work?layout=${layout}`],
  });
  renderWithProviders(<RouterProvider router={router} />);
}

/** Each source mark the card shows: beside its title, and on its upstream link when it has one. */
function sourceMarks(card: HTMLElement) {
  return [...card.querySelectorAll('[data-source]')].map(mark => mark.getAttribute('data-source'));
}

// Cards filed by Vanta, Dependabot and Detail used to fall back to the hand-filed card's source on the
// board, though the server's source filter files them under their integration.
describe('Board cards filed by an integration', () => {
  describe('when Vanta files a vulnerability', () => {
    it.each(LAYOUTS)('shows it as a Vanta card in the %s', async layout => {
      renderBoard(vantaCard, layout);

      const card = await screen.findByTestId('work-item-card');
      expect(card).toHaveTextContent('Vanta: npm-picomatch <= 4.0.7: CVE-2026-112366');
      expect(sourceMarks(card)).toEqual(['vanta-vulnerability', 'vanta-vulnerability']);
    });

    it('links to the vulnerability by its CVE', async () => {
      renderBoard(vantaCard, 'list');

      const card = await screen.findByTestId('work-item-card');
      expect(within(card).getByRole('link', { name: 'Open vulnerability: CVE-2026-112366' })).toHaveAttribute(
        'href',
        vantaVulnerabilityUrl,
      );
    });
  });

  describe('when Dependabot raises an alert', () => {
    it.each(LAYOUTS)('shows it as a GitHub Dependabot alert in the %s', async layout => {
      renderBoard(dependabotCard, layout);

      const card = await screen.findByTestId('work-item-card');
      expect(card).toHaveTextContent('Dependabot alert: picomatch: vulnerable to ReDoS');
      expect(sourceMarks(card)).toEqual(['github-dependabot-alert', 'github-dependabot-alert']);
      expect(within(card).getByRole('link', { name: 'Open in GitHub: #3543' })).toHaveAttribute(
        'href',
        dependabotAlertUrl,
      );
    });
  });

  describe('when Detail reports a finding', () => {
    it.each(LAYOUTS)('shows it as a Detail finding in the %s', async layout => {
      renderBoard(detailCard, layout);

      const card = await screen.findByTestId('work-item-card');
      expect(card).toHaveTextContent('Detail: Unchecked redirect in the login flow');
      expect(sourceMarks(card)).toEqual(['detail-finding', 'detail-finding']);
    });
  });

  describe('when GitLab files an issue', () => {
    // GitLab's mark used to drop the attributes the board stamps on it, so its cards showed no source.
    it.each(LAYOUTS)('marks it and its link as GitLab in the %s', async layout => {
      renderBoard(gitlabCard, layout);

      const card = await screen.findByTestId('work-item-card');
      expect(sourceMarks(card)).toEqual(['gitlab-issue', 'gitlab-issue']);
      expect(within(card).getByRole('link', { name: /^Open in GitLab: / })).toHaveAttribute(
        'href',
        'https://gitlab.com/acme/app/-/issues/42',
      );
    });
  });

  describe('when a person files a card by hand', () => {
    it.each(LAYOUTS)('keeps showing it as a manual card in the %s', async layout => {
      renderBoard(nativeFactsCard, layout);

      const card = await screen.findByTestId('work-item-card');
      expect(card).toHaveTextContent('Manual: Write the guide');
      expect(sourceMarks(card)).toEqual(['manual']);
    });
  });
});
