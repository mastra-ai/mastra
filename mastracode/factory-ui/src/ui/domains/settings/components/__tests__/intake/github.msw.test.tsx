import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../../e2e/ui/msw-server';
import type { IntakeConfig } from '../../../../factory/services/intake';
import {
  CONFIG_URL,
  GITHUB_STATUS_URL,
  githubReadyStatus,
  seedGithubProject,
  useIntakeHandlers,
  renderIntakeSection,
  openSourcePicker,
  closeSourcePicker,
} from './fixtures';

describe('IntakeSection github', () => {
  describe('when the GitHub source is toggled off', () => {
    it('toggles only GitHub from its header label and blocks conflicting changes while saving', async () => {
      seedGithubProject();
      useIntakeHandlers();
      const saved: IntakeConfig[] = [];
      let releaseSave!: () => void;
      const pendingSave = new Promise<void>(resolve => {
        releaseSave = resolve;
      });
      server.use(
        http.put<Record<string, never>, IntakeConfig>(CONFIG_URL, async ({ request }) => {
          const config = await request.json();
          saved.push(config);
          await pendingSave;
          return HttpResponse.json({ config });
        }),
      );
      renderIntakeSection();
      const github = within(await screen.findByRole('region', { name: 'GitHub' }));
      const toggle = github.getByRole('switch', { name: 'Sync GitHub issues' });
      await userEvent.click(github.getByRole('button', { name: 'About Sync GitHub issues' }));
      expect(toggle).toBeChecked();
      expect(saved).toHaveLength(0);
      await userEvent.keyboard('{Escape}');
      await userEvent.click(github.getByText('Sync issues'));
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].github.enabled).toBe(false);
      expect(saved[0].linear.enabled).toBe(true);
      expect(toggle).toBeDisabled();
      const linear = within(screen.getByRole('region', { name: 'Linear' }));
      expect(linear.getByRole('switch', { name: 'Sync Linear issues' })).toBeDisabled();
      await userEvent.click(github.getByText('Sync issues'));
      expect(saved).toHaveLength(1);
      releaseSave();
      await waitFor(() => expect(toggle).toBeEnabled());
      expect(toggle).not.toBeChecked();
    });

    it('persists the config with github disabled', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers();

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('switch', { name: 'Sync GitHub issues' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].github.enabled).toBe(false);
      expect(saved[0].linear.enabled).toBe(true);
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
      expect(screen.queryByRole('checkbox', { name: 'mastra' })).not.toBeInTheDocument();
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
      expect(screen.queryByRole('checkbox', { name: 'mastra' })).not.toBeInTheDocument();
      expect(statusRequests).toHaveLength(1);

      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(statusRequests).toHaveLength(2));
      await openSourcePicker('Repositories');
      expect(await screen.findByRole('checkbox', { name: 'mastra' })).toBeInTheDocument();
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

      await userEvent.click(await screen.findByRole('checkbox', { name: 'mastra' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].github.sourceIds).toEqual(['mastra']);
      expect(saved[0]).not.toHaveProperty('github.repositoryIds');
    });
  });
});
