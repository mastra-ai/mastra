import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { PullRequestLinks } from '../StatusLine/PullRequestLinks';

const FACTORY_PROJECT_ID = 'factory-project-1';
const SESSION_RESOURCE_ID = 'thread-1';
const THREAD_ID = 'thread-1';

function renderLinks({ factoryProjectId }: { factoryProjectId?: string } = {}) {
  return renderWithProviders(
    <PullRequestLinks
      baseUrl="http://localhost:4111"
      resourceId={SESSION_RESOURCE_ID}
      projectPath={undefined}
      projectRepositoryId="project-repo-1"
      factoryProjectId={factoryProjectId}
      repositorySlug="acme/widgets"
      threadId={THREAD_ID}
      transcriptEntries={[]}
      busy={false}
    />,
  );
}

describe('PullRequestLinks subscription lookup', () => {
  it('queries subscriptions with the factory project id when the session is factory-bound', async () => {
    const seenResourceIds: (string | null)[] = [];
    server.use(
      http.get('*/web/factory/projects/:id/work-items', () => HttpResponse.json({ workItems: [] })),
      http.get('*/web/github/subscriptions', ({ request }) => {
        const url = new URL(request.url);
        seenResourceIds.push(url.searchParams.get('resourceId'));
        return HttpResponse.json({
          subscriptions: [
            {
              id: 'sub-1',
              repoFullName: 'acme/widgets',
              pullRequestNumber: 65,
              status: 'open',
              url: 'https://github.com/acme/widgets/pull/65',
            },
          ],
        });
      }),
    );

    renderLinks({ factoryProjectId: FACTORY_PROJECT_ID });

    // Subscriptions are stored keyed on the factory project id, so the chip
    // only renders when the query carries it instead of the chat resourceId.
    expect(await screen.findByText('PR #65')).toBeInTheDocument();
    await waitFor(() => expect(seenResourceIds).toContain(FACTORY_PROJECT_ID));
    expect(seenResourceIds).not.toContain(SESSION_RESOURCE_ID);
  });

  it('falls back to the chat resourceId outside factory sessions', async () => {
    const seenResourceIds: (string | null)[] = [];
    server.use(
      http.get('*/web/github/subscriptions', ({ request }) => {
        const url = new URL(request.url);
        seenResourceIds.push(url.searchParams.get('resourceId'));
        return HttpResponse.json({ subscriptions: [] });
      }),
    );

    renderLinks();

    await waitFor(() => expect(seenResourceIds).toContain(SESSION_RESOURCE_ID));
  });
});
