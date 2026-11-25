import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../../e2e/ui/msw-server';
import {
  GITHUB_STATUS_URL,
  githubReadyStatus,
  seedGithubProject,
  useIntakeHandlers,
  renderIntakeSection,
  openSourcePicker,
  baseConfig,
} from './fixtures';

describe('IntakeSection github', () => {
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
      expect(screen.queryByRole('button', { name: 'Add mastra' })).not.toBeInTheDocument();
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
      expect(statusRequests).toHaveLength(1);

      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(statusRequests).toHaveLength(2));
      await waitFor(() => expect(screen.queryByText('GitHub status could not be loaded.')).not.toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });
  });

  describe('when a GitHub repository is picked', () => {
    it('persists an explicit repository selection under sourceIds', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers();

      renderIntakeSection();
      await openSourcePicker('Bring in issues from');

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
    });

    it('hides Dependabot controls when the server does not register it', async () => {
      seedGithubProject();
      useIntakeHandlers();
      renderIntakeSection();
      await screen.findByRole('region', { name: 'GitHub' });
      expect(screen.queryByRole('switch', { name: 'Sync Dependabot alerts' })).not.toBeInTheDocument();
    });
  });
});
