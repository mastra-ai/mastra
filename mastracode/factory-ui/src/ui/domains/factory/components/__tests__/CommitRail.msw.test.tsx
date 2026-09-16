import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { CommitRail } from '../CommitRail';

const REPOSITORY_ID = 'repository-1';

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

describe('CommitRail', () => {
  it('lists the branch tip first, each row linking to its commit on GitHub', async () => {
    stubCommits(COMMITS);
    renderWithProviders(<CommitRail projectRepositoryId={REPOSITORY_ID} />);

    const rows = await screen.findAllByRole('link');
    expect(rows.map(row => row.getAttribute('href'))).toEqual([COMMITS[0]!.url, COMMITS[1]!.url]);
    expect(rows[0]).toHaveTextContent('Merge revised EBITDA into the base model');
    expect(rows[0]).toHaveTextContent('abcdef1');
  });

  it('marks only the newest commit as the tip of the branch', async () => {
    stubCommits(COMMITS);
    renderWithProviders(<CommitRail projectRepositoryId={REPOSITORY_ID} />);

    expect(await screen.findAllByLabelText('Tip of the branch')).toHaveLength(1);
  });

  it('holds the rail at seven rows until asked for the rest', async () => {
    stubCommits(
      Array.from({ length: 9 }, (_, index) => ({
        ...COMMITS[0]!,
        sha: `commit${index}`,
        url: `https://github.com/acme/app/commit/commit${index}`,
      })),
    );
    renderWithProviders(<CommitRail projectRepositoryId={REPOSITORY_ID} />);

    expect(await screen.findAllByRole('link')).toHaveLength(7);

    await userEvent.click(screen.getByRole('button', { name: 'Show 2 more' }));

    expect(screen.getAllByRole('link')).toHaveLength(9);
    expect(screen.queryByRole('button', { name: /Show/ })).not.toBeInTheDocument();
  });

  it('says so when no repository is linked, rather than loading for ever', async () => {
    renderWithProviders(<CommitRail projectRepositoryId={undefined} />);

    expect(await screen.findByText('No repository linked yet')).toBeInTheDocument();
  });

  it('says so when the branch has no commits', async () => {
    stubCommits([]);
    renderWithProviders(<CommitRail projectRepositoryId={REPOSITORY_ID} />);

    expect(await screen.findByText('No commits yet')).toBeInTheDocument();
  });

  it('reports a GitHub outage instead of an empty rail', async () => {
    server.use(
      http.get('*/web/github/projects/:id/commits', () =>
        HttpResponse.json({ error: 'GitHub rejected the commit listing' }, { status: 502 }),
      ),
    );
    renderWithProviders(<CommitRail projectRepositoryId={REPOSITORY_ID} />);

    expect(await screen.findByText('Could not reach GitHub for the commit history.')).toBeInTheDocument();
  });
});
