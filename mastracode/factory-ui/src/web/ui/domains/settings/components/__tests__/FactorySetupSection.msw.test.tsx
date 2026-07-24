/**
 * BDD coverage for Settings › General › Worktree setup.
 *
 * Drives the real FactorySetupSection through the fetch/save services and
 * React Query; only the network is mocked (MSW).
 */
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { RepositorySettings } from '../../../workspaces/services/github';
import { FactorySetupSection } from '../FactorySetupSection';

const SETTINGS_URL = `${TEST_BASE_URL}/web/github/projects/ghp-1/settings`;
const FIELD = 'Setup command for mastra';

function seedGithubProject() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-fp-1',
            repositories: [
              {
                id: 'ghp-1',
                branch: null,
                sandboxWorkdir: null,
                repository: { slug: 'mastra', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
  );
}

function useSettingsHandlers(initial: RepositorySettings = { setupCommand: null }) {
  const saved: RepositorySettings[] = [];
  server.use(
    http.get(SETTINGS_URL, () => HttpResponse.json(initial)),
    http.post(SETTINGS_URL, async ({ request }) => {
      const next = (await request.json()) as RepositorySettings;
      saved.push(next);
      return HttpResponse.json(next);
    }),
  );
  return saved;
}

function renderSection() {
  return renderWithProviders(
    <>
      <FactorySetupSection />
      <Toaster position="bottom-right" />
    </>,
  );
}

describe('FactorySetupSection', () => {
  it('given no github projects, when rendered, then the section is hidden', () => {
    renderSection();
    expect(screen.queryByText('Worktree setup')).not.toBeInTheDocument();
  });

  it('given a stored setup command, when rendered, then the field shows it', async () => {
    seedGithubProject();
    useSettingsHandlers({ setupCommand: 'pnpm i && pnpm build' });

    renderSection();

    expect(await screen.findByText('Worktree setup')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: FIELD })).toHaveValue('pnpm i && pnpm build'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('given an edited command, when saving, then it persists and the button disables again', async () => {
    seedGithubProject();
    const saved = useSettingsHandlers();
    const user = userEvent.setup();

    renderSection();

    const input = await screen.findByRole('textbox', { name: FIELD });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, 'pnpm i && pnpm build');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saved).toEqual([{ setupCommand: 'pnpm i && pnpm build' }]));
    expect(await screen.findByText('Setup command saved')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
  });

  it('given a stored command, when cleared and saved, then null is persisted', async () => {
    seedGithubProject();
    const saved = useSettingsHandlers({ setupCommand: 'pnpm i' });
    const user = userEvent.setup();

    renderSection();

    const input = await screen.findByRole('textbox', { name: FIELD });
    await waitFor(() => expect(input).toHaveValue('pnpm i'));
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saved).toEqual([{ setupCommand: null }]));
  });

  it('given the server rejects the save, when saving fails, then an error toast appears', async () => {
    seedGithubProject();
    server.use(
      http.get(SETTINGS_URL, () => HttpResponse.json({ setupCommand: null })),
      http.post(SETTINGS_URL, () => HttpResponse.json({ error: 'Invalid setupCommand' }, { status: 400 })),
    );
    const user = userEvent.setup();

    renderSection();

    const input = await screen.findByRole('textbox', { name: FIELD });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, 'rm -rf oops');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Invalid setupCommand')).toBeInTheDocument();
  });
});
