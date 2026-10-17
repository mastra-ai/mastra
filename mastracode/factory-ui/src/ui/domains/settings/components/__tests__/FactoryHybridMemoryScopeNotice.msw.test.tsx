import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { FactoryHybridMemoryScopeNotice } from '../FactoryHybridMemoryScopeNotice';

const NOTICE_TITLE = 'Work items and chats resolve Auto differently here';

function renderNotice(modelScope: 'factory' | 'hybrid' | 'user') {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
      HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope } }),
    ),
  );
  return renderWithProviders(<FactoryHybridMemoryScopeNotice factoryId="fp-1" />);
}

function waitForProject() {
  return new Promise<void>(resolve => {
    server.events.on('response:mocked', ({ request }) => {
      if (request.url.endsWith('/web/factory/projects/fp-1')) resolve();
    });
  });
}

afterEach(() => {
  server.events.removeAllListeners('response:mocked');
});

describe('FactoryHybridMemoryScopeNotice', () => {
  it('says which context the Auto preview describes in a hybrid Factory', async () => {
    renderNotice('hybrid');

    const notice = await screen.findByRole('note');
    expect(notice).toHaveTextContent(NOTICE_TITLE);
    // The preview is the work items', so the notice has to say the chats differ.
    expect(notice).toHaveTextContent('Work items in this Factory run on its organization credentials');
    expect(notice).toHaveTextContent('Your other chats in this Factory use your own credentials');
  });

  it('stays hidden when both contexts resolve the same credentials', async () => {
    for (const modelScope of ['factory', 'user'] as const) {
      const projectLoaded = waitForProject();
      const { unmount } = renderNotice(modelScope);

      await projectLoaded;
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(screen.queryByRole('note')).not.toBeInTheDocument();
      unmount();
    }
  });
});
