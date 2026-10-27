import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import { baseConfig, gitlabReadyStatus, useGitLabHandlers, renderIntakeSection, openSourcePicker } from './fixtures';

describe('IntakeSection gitlab', () => {
  it('does not offer a linked GitLab repository as a GitHub intake source', async () => {
    useGitLabHandlers({
      ...baseConfig(),
      gitlab: { enabled: true, sourceIds: null },
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              id: 'gitlab-connection',
              integrationId: 'gitlab',
              installationId: 'gitlab-installation',
              repositories: [
                {
                  id: 'gitlab-link',
                  branch: 'main',
                  sandboxWorkdir: '~/app',
                  repository: { slug: 'acme/app', defaultBranch: 'main' },
                },
              ],
            },
          ],
        }),
      ),
    );

    renderIntakeSection();

    const githubSection = await screen.findByRole('region', { name: 'GitHub' });
    expect(await within(githubSection).findByText('No linked repositories yet')).toBeInTheDocument();
    expect(within(githubSection).queryByRole('checkbox', { name: 'acme/app' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'GitHub routing' })).not.toBeInTheDocument();
    await openSourcePicker('GitLab projects');
    const gitlabProjects = await screen.findByRole('group', { name: 'GitLab projects' });
    expect(within(gitlabProjects).getByRole('checkbox', { name: 'acme/app' })).toBeInTheDocument();
  });

  it('selects a project and routes it to a Factory board', async () => {
    const { saved, savedBindings } = useGitLabHandlers({
      ...baseConfig(),
      gitlab: { enabled: true, sourceIds: null },
    });

    renderIntakeSection();

    expect(await within(await screen.findByRole('region', { name: 'GitLab' })).findByText('acme')).toBeInTheDocument();
    await openSourcePicker('GitLab projects');
    const projects = await screen.findByRole('group', { name: 'GitLab projects' });
    await userEvent.click(within(projects).getByRole('checkbox', { name: 'acme/app' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].gitlab.sourceIds).toEqual(['gitlab-project:encoded']);
    expect(await screen.findByText(/Not routed — this source's issues won't be picked up/)).toBeInTheDocument();

    await userEvent.click(await screen.findByLabelText('Factory for acme/app'));
    await userEvent.click(await screen.findByRole('option', { name: 'Acme Web' }));
    await userEvent.click(await screen.findByLabelText('Board for acme/app'));
    await userEvent.click(await screen.findByRole('option', { name: 'Work' }));

    await waitFor(() =>
      expect(savedBindings).toEqual([
        {
          integrationId: 'gitlab',
          sourceId: 'gitlab-project:encoded',
          factoryProjectId: 'fp-1',
          board: 'work',
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

    expect(await screen.findByText('A GitLab account needs to be reconnected in Mastra Platform.')).toBeInTheDocument();
    await openSourcePicker('GitLab projects');
    expect(await screen.findByRole('checkbox', { name: 'acme/app' })).toBeInTheDocument();
  });
});
