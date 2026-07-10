import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { ToastProvider } from '../../../../ui';
import type { IntakeConfig } from '../../../factory/services/intake';
import type { LinearProject, LinearStatus } from '../../../factory/services/linear';
import { IntakeSection } from '../IntakeSection';

const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;
const LINEAR_STATUS_URL = `${TEST_BASE_URL}/web/linear/status`;
const LINEAR_PROJECTS_URL = `${TEST_BASE_URL}/web/linear/projects`;

function baseConfig(): IntakeConfig {
  return {
    github: { enabled: true, projectIds: null },
    linear: { enabled: true, projectIds: null },
  };
}

const connectedStatus: LinearStatus = {
  enabled: true,
  connected: true,
  workspace: { name: 'Acme', urlKey: 'acme' },
  reason: 'ready',
};

const linearProjects: LinearProject[] = [
  { id: 'lproj-1', name: 'Q3 Roadmap', state: 'started', teamKeys: ['ENG'] },
  { id: 'lproj-2', name: 'Design refresh', state: 'planned', teamKeys: [] },
];

function seedGithubProject() {
  localStorage.setItem(
    'mastracode-projects',
    JSON.stringify([
      {
        id: 'project-gh',
        name: 'mastra',
        source: 'github',
        githubProjectId: 'ghp-1',
        resourceId: 'resource-gh',
        createdAt: 1,
      },
    ]),
  );
}

function useIntakeHandlers({
  config = baseConfig(),
  status = connectedStatus,
}: { config?: IntakeConfig; status?: LinearStatus } = {}) {
  const saved: IntakeConfig[] = [];
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json({ config })),
    http.put(CONFIG_URL, async ({ request }) => {
      const next = (await request.json()) as IntakeConfig;
      saved.push(next);
      return HttpResponse.json({ config: next });
    }),
    http.get(LINEAR_STATUS_URL, () => HttpResponse.json(status)),
    http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ projects: linearProjects })),
  );
  return saved;
}

function renderIntakeSection() {
  return renderWithProviders(
    <ToastProvider>
      <IntakeSection />
    </ToastProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
});

describe('IntakeSection', () => {
  describe('given a config with both sources enabled', () => {
    it('renders the GitHub project and Linear project pickers', async () => {
      seedGithubProject();
      useIntakeHandlers();

      renderIntakeSection();

      expect(await screen.findByText('Intake sources')).toBeInTheDocument();
      expect(await screen.findByRole('switch', { name: 'Sync GitHub' })).toBeChecked();
      expect(await screen.findByRole('switch', { name: 'Sync Linear' })).toBeChecked();
      expect(await screen.findByRole('checkbox', { name: 'mastra' })).toBeInTheDocument();
      expect(await screen.findByRole('checkbox', { name: 'Q3 Roadmap (ENG)' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Design refresh' })).toBeInTheDocument();
    });
  });

  describe('when the GitHub source is toggled off', () => {
    it('persists the config with github disabled', async () => {
      seedGithubProject();
      const saved = useIntakeHandlers();

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('switch', { name: 'Sync GitHub' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.github.enabled).toBe(false);
      expect(saved[0]!.linear.enabled).toBe(true);
      expect(await screen.findByText('Intake sources updated')).toBeInTheDocument();
    });
  });

  describe('when a Linear project is picked', () => {
    it('persists an explicit project selection', async () => {
      const saved = useIntakeHandlers();

      renderIntakeSection();

      await userEvent.click(await screen.findByRole('checkbox', { name: 'Q3 Roadmap (ENG)' }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]!.linear.projectIds).toEqual(['lproj-1']);
    });
  });

  describe('given Linear is not connected', () => {
    it('shows the connect prompt instead of the project picker', async () => {
      useIntakeHandlers({
        status: { enabled: true, connected: false, workspace: null, reason: 'not_connected' },
      });

      renderIntakeSection();

      expect(await screen.findByText('Connect a Linear workspace to sync its issues.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Connect Linear' })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Q3 Roadmap (ENG)' })).not.toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Sync Linear' })).toBeDisabled();
    });
  });

  describe('given Linear is not configured on the server', () => {
    it('explains the source is unavailable without a connect button', async () => {
      useIntakeHandlers({ status: { enabled: false, connected: false, workspace: null, reason: 'missing_config' } });

      renderIntakeSection();

      expect(await screen.findByText('Linear is not configured on this server.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Connect Linear' })).not.toBeInTheDocument();
    });
  });

  describe('given the config endpoint fails', () => {
    it('shows the unavailable notice', async () => {
      server.use(
        http.get(CONFIG_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })),
        http.get(LINEAR_STATUS_URL, () => HttpResponse.json(connectedStatus)),
        http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ projects: linearProjects })),
      );

      renderIntakeSection();

      expect(await screen.findByText(/Intake configuration is unavailable/)).toBeInTheDocument();
    });
  });
});
