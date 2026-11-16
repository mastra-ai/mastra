import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { listedRepository } from '../../../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import {
  baseConfig,
  gitlabReadyStatus,
  useGitLabHandlers,
  renderIntakeSection,
  openSourcePicker,
  closeSourcePicker,
} from './fixtures';

describe('IntakeSection gitlab', () => {
  describe('given GitLab is configured', () => {
    it('does not offer a linked GitLab repository as a GitHub intake source', async () => {
      useGitLabHandlers({
        ...baseConfig(),
        gitlab: { enabled: true, sourceIds: null },
      });
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
          HttpResponse.json({
            projects: [
              {
                id: 'fp-1',
                name: 'Acme Web',
                repositories: [
                  listedRepository('gitlab-link', 'acme/app', {
                    integrationId: 'gitlab',
                    branch: 'main',
                    sandboxWorkdir: '~/app',
                  }),
                ],
              },
            ],
          }),
        ),
      );

      renderIntakeSection();

      const githubSection = await screen.findByRole('region', { name: 'GitHub' });
      expect(await within(githubSection).findByText('No linked repositories yet')).toBeInTheDocument();
      expect(within(githubSection).queryByRole('button', { name: 'Add acme/app' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'GitHub routing' })).not.toBeInTheDocument();
      await openSourcePicker('GitLab projects');
      const gitlabProjects = await screen.findByRole('group', { name: 'GitLab projects' });
      expect(within(gitlabProjects).getByRole('button', { name: 'Add acme/app' })).toBeInTheDocument();
    });

    it('selects a project and routes it to a Factory board', async () => {
      const { saved, savedBindings } = useGitLabHandlers({
        ...baseConfig(),
        gitlab: { enabled: true, sourceIds: null },
      });

      renderIntakeSection();

      expect(
        await within(await screen.findByRole('region', { name: 'GitLab' })).findByText('acme'),
      ).toBeInTheDocument();
      await openSourcePicker('GitLab projects');
      const projects = await screen.findByRole('group', { name: 'GitLab projects' });
      await userEvent.click(within(projects).getByRole('button', { name: 'Add acme/app' }));

      await waitFor(() =>
        expect(saved).toEqual([{ gitlab: { enabled: true, sourceIds: ['gitlab-project:encoded'] } }]),
      );
      await closeSourcePicker();
      expect(await screen.findByText(/Not routed. This source's issues won't be picked up/)).toBeInTheDocument();

      await userEvent.click(await screen.findByLabelText('Factory for acme/app'));
      await userEvent.click(await screen.findByRole('option', { name: 'Acme Web' }));

      await waitFor(() =>
        expect(savedBindings).toEqual([
          {
            integrationId: 'gitlab',
            sourceId: 'gitlab-project:encoded',
            factoryProjectId: 'fp-1',
          },
        ]),
      );
      expect((await screen.findAllByText('GitLab routing updated')).length).toBeGreaterThan(0);
    });

    it('keeps healthy projects available when another Platform connection needs reauthorization', async () => {
      useGitLabHandlers(
        { ...baseConfig(), gitlab: { enabled: true, sourceIds: null } },
        {
          ...gitlabReadyStatus,
          connections: [
            ...gitlabReadyStatus.connections!,
            { id: 'a1b_old', integrationId: 'gitlab', status: 'needs_reauth', accountLabel: 'old' },
          ],
          reauthRequired: true,
        },
      );

      renderIntakeSection();

      expect(await screen.findByText('A GitLab account needs to be reconnected.')).toBeInTheDocument();
      await openSourcePicker('GitLab projects');
      expect(await screen.findByRole('button', { name: 'Add acme/app' })).toBeInTheDocument();
    });

    it('keeps two connections with the same account label apart', async () => {
      useGitLabHandlers(
        { ...baseConfig(), gitlab: { enabled: true, sourceIds: null } },
        {
          ...gitlabReadyStatus,
          connections: [
            { id: 'a1b_acme', integrationId: 'gitlab', status: 'active', accountLabel: 'acme' },
            { id: 'a1b_acme_self_hosted', integrationId: 'gitlab', status: 'active', accountLabel: 'acme' },
          ],
        },
      );
      server.use(
        http.get(`${TEST_BASE_URL}/web/gitlab/projects`, () =>
          HttpResponse.json({
            projects: [
              { id: 'gitlab-project:saas', name: 'acme/app', connectionId: 'a1b_acme', accountLabel: 'acme' },
              {
                id: 'gitlab-project:self-hosted',
                name: 'acme/app',
                connectionId: 'a1b_acme_self_hosted',
                accountLabel: 'acme',
              },
            ],
          }),
        ),
      );

      renderIntakeSection();

      await openSourcePicker('GitLab projects');
      expect(await screen.findByText('acme (connection 1)')).toBeInTheDocument();
      expect(screen.getByText('acme (connection 2)')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Add acme/app' })).toHaveLength(2);
    });
  });
});
