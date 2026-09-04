import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { FactoryProject, RepositorySettings } from '../../../workspaces/services/github';
import { FactorySetupSection } from '../FactorySetupSection';

const SETTINGS_URL = `${TEST_BASE_URL}/web/github/projects/ghp-1/settings`;
const FIELD = 'Setup command for mastra';
const TEARDOWN_FIELD = 'Teardown command for mastra';

const emptyFactory: FactoryProject = { id: 'fp-1', name: 'mastra', repositories: [] };
const factory: FactoryProject = {
  id: 'fp-1',
  name: 'mastra',
  repositories: [{ projectRepositoryId: 'ghp-1', slug: 'mastra' }],
};

function useSettingsHandlers(initial: RepositorySettings = { setupCommand: null, teardownCommand: null }) {
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

function renderSection(factoryProject: FactoryProject = emptyFactory) {
  return renderWithProviders(
    <>
      <FactorySetupSection factory={factoryProject} />
      <Toaster position="bottom-right" />
    </>,
  );
}

describe('FactorySetupSection', () => {
  it('given no github projects, when rendered, then the section is hidden', () => {
    renderSection();
    expect(screen.queryByText('Sandbox')).not.toBeInTheDocument();
  });

  it('given stored commands, when rendered, then each command has its own row', async () => {
    useSettingsHandlers({ setupCommand: 'pnpm i && pnpm build', teardownCommand: 'pnpm local teardown' });

    renderSection(factory);

    expect(await screen.findByText('Sandbox')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: FIELD })).toHaveValue('pnpm i && pnpm build'));
    expect(screen.getByRole('textbox', { name: TEARDOWN_FIELD })).toHaveValue('pnpm local teardown');
  });

  it('given an edited setup command, when the field is left, then it persists on its own', async () => {
    const saved = useSettingsHandlers();
    const user = userEvent.setup();

    renderSection(factory);

    const input = await screen.findByRole('textbox', { name: FIELD });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, 'pnpm i && pnpm build');
    await user.tab();

    await waitFor(() => expect(saved).toEqual([{ setupCommand: 'pnpm i && pnpm build', teardownCommand: null }]));
    expect(await screen.findByText('Sandbox commands saved')).toBeInTheDocument();
  });

  it('given an unchanged field, when it is left, then nothing is saved', async () => {
    const saved = useSettingsHandlers({ setupCommand: 'pnpm i', teardownCommand: null });
    const user = userEvent.setup();

    renderSection(factory);

    const input = await screen.findByRole('textbox', { name: FIELD });
    await waitFor(() => expect(input).toHaveValue('pnpm i'));
    await user.click(input);
    await user.tab();

    // A real save on the other field lands after any request the untouched one
    // could have fired, so a stray save shows up as a second entry here.
    await user.type(screen.getByRole('textbox', { name: TEARDOWN_FIELD }), 'pnpm local teardown');
    await user.tab();

    await waitFor(() => expect(saved).toEqual([{ setupCommand: 'pnpm i', teardownCommand: 'pnpm local teardown' }]));
  });

  it('given a stored command, when cleared, then null is persisted and the other command is kept', async () => {
    const saved = useSettingsHandlers({ setupCommand: 'pnpm i', teardownCommand: 'pnpm local teardown' });
    const user = userEvent.setup();

    renderSection(factory);

    const input = await screen.findByRole('textbox', { name: FIELD });
    await waitFor(() => expect(input).toHaveValue('pnpm i'));
    await user.clear(input);
    await user.tab();

    await waitFor(() => expect(saved).toEqual([{ setupCommand: null, teardownCommand: 'pnpm local teardown' }]));
  });

  it('given the server rejects the save, when saving fails, then the typed command stays in the field', async () => {
    server.use(
      http.get(SETTINGS_URL, () => HttpResponse.json({ setupCommand: 'pnpm i', teardownCommand: null })),
      http.post(SETTINGS_URL, () => HttpResponse.json({ error: 'Invalid setupCommand' }, { status: 400 })),
    );
    const user = userEvent.setup();

    renderSection(factory);

    const input = await screen.findByRole('textbox', { name: FIELD });
    await waitFor(() => expect(input).toHaveValue('pnpm i'));
    await user.clear(input);
    await user.type(input, 'pnpm i --frozen-lockfile');
    await user.tab();

    expect(await screen.findByText('Invalid setupCommand')).toBeInTheDocument();
    expect(input).toHaveValue('pnpm i --frozen-lockfile');
  });

  it('given the server rejects the save, when saving fails, then an error toast appears', async () => {
    server.use(
      http.get(SETTINGS_URL, () => HttpResponse.json({ setupCommand: null, teardownCommand: null })),
      http.post(SETTINGS_URL, () => HttpResponse.json({ error: 'Invalid setupCommand' }, { status: 400 })),
    );
    const user = userEvent.setup();

    renderSection(factory);

    const input = await screen.findByRole('textbox', { name: FIELD });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, 'rm -rf oops');
    await user.tab();

    expect(await screen.findByText('Invalid setupCommand')).toBeInTheDocument();
  });
});
