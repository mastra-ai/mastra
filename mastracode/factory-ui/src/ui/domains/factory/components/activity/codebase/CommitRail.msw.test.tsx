import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { renderWithProviders } from '../../../../../../../e2e/ui/render';
import { CommitRail } from './CommitRail';

const REPOSITORY_ID = 'repository-1';
const FACTORY_ID = 'factory-1';

const COMMITS = [
  {
    sha: 'abcdef1234567890',
    message: 'Merge revised EBITDA into the base model',
    author: 'kev-droid',
    avatarUrl: null,
    committedAt: '2026-08-31T10:00:00.000Z',
    url: 'https://github.com/acme/app/commit/abcdef1234567890',
  },
  {
    sha: 'fedcba0987654321',
    message: 'Prepare merge preview for affected rows',
    author: 'ada',
    avatarUrl: null,
    committedAt: '2026-08-31T08:00:00.000Z',
    url: 'https://github.com/acme/app/commit/fedcba0987654321',
  },
];

function stubCommits(commits: unknown[]) {
  server.use(http.get('*/web/github/projects/:id/commits', () => HttpResponse.json({ commits, branch: 'main' })));
}

function renderRail(projectRepositoryId: string | undefined) {
  return renderWithProviders(
    <MemoryRouter>
      <CommitRail projectRepositoryId={projectRepositoryId} factoryProjectId={FACTORY_ID} />
    </MemoryRouter>,
  );
}

describe('CommitRail', () => {
  it('lists the branch tip first, each row linking to its commit on GitHub', async () => {
    stubCommits(COMMITS);
    renderRail(REPOSITORY_ID);

    const rows = await screen.findAllByRole('link');
    expect(rows.map(row => row.getAttribute('href'))).toEqual([COMMITS[0].url, COMMITS[1].url]);
    expect(rows[0]).toHaveTextContent('Merge revised EBITDA into the base model');
    expect(rows[0]).toHaveTextContent('abcdef1');
  });

  it('marks only the newest commit as the tip of the branch', async () => {
    stubCommits(COMMITS);
    renderRail(REPOSITORY_ID);

    expect(await screen.findAllByLabelText('Tip of the branch')).toHaveLength(1);
  });

  it('cuts the history by day, newest day first', async () => {
    stubCommits([COMMITS[0], { ...COMMITS[1], committedAt: '2026-08-29T12:00:00.000Z' }]);
    renderRail(REPOSITORY_ID);

    const days = await screen.findAllByRole('region');
    expect(days.map(day => within(day).getByRole('link').textContent)).toEqual([
      expect.stringContaining(COMMITS[0].message),
      expect.stringContaining(COMMITS[1].message),
    ]);
  });

  it('says so when no repository is linked, rather than loading for ever', async () => {
    renderRail(undefined);

    expect(await screen.findByRole('heading', { name: 'No repository linked yet', level: 4 })).toBeInTheDocument();
  });

  it('says so when the branch has no commits', async () => {
    stubCommits([]);
    renderRail(REPOSITORY_ID);

    expect(await screen.findByRole('heading', { name: 'No commits yet', level: 4 })).toBeInTheDocument();
  });

  it('reports a GitHub outage instead of an empty rail', async () => {
    server.use(
      http.get('*/web/github/projects/:id/commits', () =>
        HttpResponse.json({ error: 'GitHub rejected the commit listing' }, { status: 502 }),
      ),
    );
    renderRail(REPOSITORY_ID);

    expect(await screen.findByText('Could not reach GitHub for the commit history.')).toBeInTheDocument();
  });
});
