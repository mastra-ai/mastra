import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../../e2e/ui/msw-server';
import {
  CONFIG_URL,
  GITHUB_STATUS_URL,
  githubReadyStatus,
  seedGithubProject,
  useIntakeHandlers,
  renderIntakeSection,
  openSourcePicker,
  closeSourcePicker,
  holdFirstPut,
  baseConfig,
} from './fixtures';

describe('IntakeSection github', () => {
  describe('when the GitHub source is toggled off', () => {
    it('toggles only GitHub from its header label and keeps the other sources editable while it saves', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers();
      const release = holdFirstPut(CONFIG_URL);
      renderIntakeSection();
      const github = within(await screen.findByRole('region', { name: 'GitHub' }));
      const toggle = github.getByRole('switch', { name: 'Sync GitHub issues' });
      await userEvent.click(github.getByRole('button', { name: 'About Sync GitHub issues' }));
      expect(toggle).toBeChecked();
      expect(saved).toHaveLength(0);
      await userEvent.keyboard('{Escape}');

      await userEvent.click(github.getByText('Sync issues'));

      expect(toggle).not.toBeChecked();
      expect(toggle).toBeEnabled();
      const linearToggle = within(screen.getByRole('region', { name: 'Linear' })).getByRole('switch', {
        name: 'Sync Linear issues',
      });
      await userEvent.click(linearToggle);
      expect(linearToggle).not.toBeChecked();

      release();

      await waitFor(() =>
        expect(saved).toEqual([
          { github: { enabled: false, sourceIds: null } },
          { linear: { enabled: false, sourceIds: null } },
        ]),
      );
      expect(toggle).not.toBeChecked();
      expect(linearToggle).not.toBeChecked();
    });

    it('persists the config with github disabled', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers();

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('switch', { name: 'Sync GitHub issues' }));

      await waitFor(() => expect(saved).toEqual([{ github: { enabled: false, sourceIds: null } }]));
      expect(await screen.findByText('Intake sources updated')).toBeInTheDocument();
    });
  });

  describe('given GitHub is not configured on the server', () => {
    it('disables GitHub intake and hides repository controls', async () => {
      seedGithubProject();
      useIntakeHandlers({
        githubStatus: {
          enabled: false,
          connected: false,
          installations: [],
          reason: 'missing_config',
        },
      });

      renderIntakeSection();

      expect(await screen.findByText('GitHub is not configured on this server.')).toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: 'Sync GitHub issues' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add mastra' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'GitHub routing' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });
  });

  describe('given the GitHub status endpoint fails', () => {
    it('reports the status as unavailable with a retry instead of claiming GitHub is not configured', async () => {
      seedGithubProject();
      useIntakeHandlers();
      const statusRequests: number[] = [];
      server.use(
        http.get(GITHUB_STATUS_URL, () => {
          statusRequests.push(statusRequests.length + 1);
          if (statusRequests.length === 1) return HttpResponse.json({ error: 'boom' }, { status: 500 });
          return HttpResponse.json(githubReadyStatus);
        }),
      );

      renderIntakeSection();

      expect(await screen.findByText('GitHub status could not be loaded.')).toBeInTheDocument();
      expect(screen.queryByText('GitHub is not configured on this server.')).not.toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync GitHub issues' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Add mastra' })).not.toBeInTheDocument();
      expect(statusRequests).toHaveLength(1);

      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(statusRequests).toHaveLength(2));
      await openSourcePicker('Repositories');
      expect(await screen.findByRole('button', { name: 'Add mastra' })).toBeInTheDocument();
      await closeSourcePicker();
      expect(screen.getByRole('switch', { name: 'Sync GitHub issues' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });
  });

  describe('when a GitHub repository is picked', () => {
    it('persists an explicit repository selection under sourceIds', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers();

      renderIntakeSection();
      await openSourcePicker('Repositories');

      await userEvent.click(await screen.findByRole('button', { name: 'Add mastra' }));

      await waitFor(() => expect(saved).toEqual([{ github: { enabled: true, sourceIds: ['mastra'] } }]));
    });
  });

  describe('given the server registers Dependabot intake', () => {
    it('turns Dependabot alert sync on and opts a repository in', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers({
        config: { ...baseConfig(), dependabot: { enabled: false, sourceIds: null } },
      });
      renderIntakeSection();
      const github = within(await screen.findByRole('region', { name: 'GitHub' }));
      expect(github.queryByRole('button', { name: / to Dependabot repositories$/ })).not.toBeInTheDocument();

      await userEvent.click(github.getByRole('switch', { name: 'Sync Dependabot alerts' }));
      await waitFor(() => expect(saved).toEqual([{ dependabot: { enabled: true, sourceIds: null } }]));

      await openSourcePicker('Dependabot repositories');
      await userEvent.click(await screen.findByRole('button', { name: 'Add mastra' }));

      await waitFor(() => expect(saved.at(-1)).toEqual({ dependabot: { enabled: true, sourceIds: ['mastra'] } }));
      await closeSourcePicker();
      expect(github.getByRole('switch', { name: 'Sync GitHub issues' })).toBeChecked();
    });

    it('hides Dependabot controls when the server does not register it', async () => {
      seedGithubProject();
      useIntakeHandlers();
      renderIntakeSection();
      await screen.findByRole('switch', { name: 'Sync GitHub issues' });
      expect(screen.queryByRole('switch', { name: 'Sync Dependabot alerts' })).not.toBeInTheDocument();
    });
  });
});
