import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import type { GitLabProject, GitLabStatus } from '../../../../factory/services/gitlab';
import type { IntakeConfig, IntakeSourceBinding } from '../../../../factory/services/intake';
import type { JiraProject, JiraStatus } from '../../../../factory/services/jira';
import type { LinearProject, LinearStatus } from '../../../../factory/services/linear';
import type { GithubStatus } from '../../../../workspaces/services/github';
import { IntakeSection } from '../../IntakeSection';

type BindingUpdate = Omit<IntakeSourceBinding, 'factoryProjectId'> & { factoryProjectId: string | null };

export const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;
export const BINDINGS_URL = `${TEST_BASE_URL}/web/intake/bindings`;
export const GITHUB_STATUS_URL = `${TEST_BASE_URL}/web/github/status`;
export const LINEAR_STATUS_URL = `${TEST_BASE_URL}/web/linear/status`;
export const LINEAR_PROJECTS_URL = `${TEST_BASE_URL}/web/linear/projects`;
export const LINEAR_TEAMS_URL = `${TEST_BASE_URL}/web/linear/teams`;
export const JIRA_STATUS_URL = `${TEST_BASE_URL}/web/jira/status`;
export const JIRA_PROJECTS_URL = `${TEST_BASE_URL}/web/jira/projects`;
export const INCIDENTIO_CONNECTIONS_URL = `${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`;
export const INTAKE_SOURCES_URL = `${TEST_BASE_URL}/web/intake/sources`;
export const GITLAB_STATUS_URL = `${TEST_BASE_URL}/web/gitlab/status`;
export const GITLAB_PROJECTS_URL = `${TEST_BASE_URL}/web/gitlab/projects`;

export const FACTORY_A = '11111111-1111-4111-8111-111111111111';
export const FACTORY_B = '22222222-2222-4222-8222-222222222222';

export function baseConfig(): IntakeConfig {
  return {
    github: { enabled: true, sourceIds: null },
    gitlab: { enabled: false, sourceIds: null },
    linear: { enabled: true, sourceIds: null },
    jira: { enabled: false, sourceIds: null },
    incidentio: { enabled: false, sourceIds: null },
  };
}

export const githubReadyStatus: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 1, accountLogin: 'acme', accountType: 'Organization' }],
  reason: 'ready',
};

export const connectedStatus: LinearStatus = {
  enabled: true,
  connected: true,
  workspace: { name: 'Acme', urlKey: 'acme' },
  reason: 'ready',
};

export const engTeam = {
  id: 'team-eng',
  key: 'ENG',
  name: 'Engineering',
  sourceId: 'linear-team:opaque-eng',
};
export const designTeam = { id: 'team-des', key: 'DES', name: 'Design' };

export const linearProjects: LinearProject[] = [
  { id: 'lproj-1', name: 'Q3 Roadmap', state: 'started', teams: [engTeam] },
  { id: 'lproj-2', name: 'Design refresh', state: 'planned', teams: [] },
  { id: 'lproj-3', name: 'Shared initiative', state: 'started', teams: [engTeam, designTeam] },
];

export const linearTeams = [engTeam, designTeam];

export function seedGithubProject() {
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

export function useIntakeHandlers({
  config = baseConfig(),
  status = connectedStatus,
  githubStatus = githubReadyStatus,
}: {
  config?: IntakeConfig;
  status?: LinearStatus;
  githubStatus?: GithubStatus;
} = {}) {
  const saved: IntakeConfig[] = [];
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json({ config })),
    http.put<Record<string, never>, IntakeConfig>(CONFIG_URL, async ({ request }) => {
      const next = await request.json();
      saved.push(next);
      return HttpResponse.json({ config: next });
    }),
    http.get(GITHUB_STATUS_URL, () => HttpResponse.json(githubStatus)),
    http.get(LINEAR_STATUS_URL, () => HttpResponse.json(status)),
    http.get(LINEAR_PROJECTS_URL, () => HttpResponse.json({ projects: linearProjects })),
    http.get(LINEAR_TEAMS_URL, () => HttpResponse.json({ teams: linearTeams })),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:id/boards`, () => HttpResponse.json({ boards: [] })),
  );
  return saved;
}

export const jiraReadyStatus: JiraStatus = {
  enabled: true,
  configured: true,
  mode: 'platform',
  site: 'acme.atlassian.net',
  sites: ['acme.atlassian.net', 'beta.atlassian.net'],
  connections: [
    {
      id: 'a1b_acme',
      integrationId: 'jira',
      status: 'active',
      accountLabel: 'acme.atlassian.net',
    },
    {
      id: 'a1b_beta',
      integrationId: 'jira',
      status: 'active',
      accountLabel: 'beta.atlassian.net',
    },
  ],
  reason: 'ready',
};

export const jiraProjects: JiraProject[] = [
  { id: '10001', key: 'ENG', name: 'Engineering', connectionId: 'a1b_acme', site: 'acme.atlassian.net' },
  { id: '10002', key: 'OPS', name: 'Operations', connectionId: 'a1b_beta', site: 'beta.atlassian.net' },
];

export function useJiraHandlers({
  config = baseConfig(),
  bindings: initial = [],
  conflict,
}: {
  config?: IntakeConfig;
  bindings?: IntakeSourceBinding[];
  /** Answer every binding save with this 409, as the server does when another factory takes the issues. */
  conflict?: { message: string; conflicts: Array<{ factoryProjectId: string; labels: string[] | null }> };
} = {}) {
  const saved = useIntakeHandlers({ config });
  let bindings = initial;
  const savedBindings: BindingUpdate[] = [];
  const deletedBindings: Array<Record<string, string>> = [];
  server.use(
    http.get(JIRA_STATUS_URL, () => HttpResponse.json(jiraReadyStatus)),
    http.get(JIRA_PROJECTS_URL, () => HttpResponse.json({ projects: jiraProjects })),
    http.get(BINDINGS_URL, () => HttpResponse.json({ bindings })),
    http.put<Record<string, never>, BindingUpdate>(BINDINGS_URL, async ({ request }) => {
      const body = await request.json();
      savedBindings.push(body);
      if (conflict) return HttpResponse.json({ error: 'binding_conflict', ...conflict }, { status: 409 });
      const factoryProjectId = body.factoryProjectId;
      if (!factoryProjectId) return HttpResponse.json({ error: 'use_delete' }, { status: 400 });
      // Jira keeps one binding per factory; other factories' bindings of the project stay.
      bindings = [
        ...bindings.filter(
          binding => !(binding.sourceId === body.sourceId && binding.factoryProjectId === factoryProjectId),
        ),
        { ...body, factoryProjectId, labels: body.labels ?? null },
      ];
      return HttpResponse.json({ bindings });
    }),
    http.delete(BINDINGS_URL, ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      deletedBindings.push(query);
      bindings = bindings.filter(
        binding => !(binding.sourceId === query.sourceId && binding.factoryProjectId === query.factoryProjectId),
      );
      return HttpResponse.json({ bindings });
    }),
  );
  return { saved, savedBindings, deletedBindings };
}

export function useIncidentioHandlers({
  config = { ...baseConfig(), incidentio: { enabled: true, sourceIds: ['incidentio-source:follow-ups'] } },
  bindings = [],
}: { config?: IntakeConfig; bindings?: IntakeSourceBinding[] } = {}) {
  const saved = useIntakeHandlers({ config });
  const savedBindings: BindingUpdate[] = [];
  server.use(
    http.get(INCIDENTIO_CONNECTIONS_URL, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'incidentio-acme',
            integrationId: 'incident-io',
            status: 'active',
            accountLabel: 'acme',
          },
        ],
      }),
    ),
    http.get(INTAKE_SOURCES_URL, () =>
      HttpResponse.json({
        sources: [
          {
            integrationId: 'incidentio',
            id: 'incidentio-source:incidents',
            name: 'Incidents (acme)',
            type: 'incident',
          },
          {
            integrationId: 'incidentio',
            id: 'incidentio-source:follow-ups',
            name: 'Incident follow-ups (acme)',
            type: 'follow-up',
          },
        ],
        failures: [],
      }),
    ),
    http.get(BINDINGS_URL, () => HttpResponse.json({ bindings })),
    http.put<Record<string, never>, BindingUpdate>(BINDINGS_URL, async ({ request }) => {
      const body = await request.json();
      savedBindings.push(body);
      const next = body.factoryProjectId === null ? [] : [{ ...body, factoryProjectId: body.factoryProjectId }];
      return HttpResponse.json({ bindings: next });
    }),
  );
  return { saved, savedBindings };
}

export const gitlabReadyStatus: GitLabStatus = {
  enabled: true,
  configured: true,
  connections: [{ id: 'a1b_acme', integrationId: 'gitlab', status: 'active', accountLabel: 'acme' }],
  accounts: ['acme'],
  reauthRequired: false,
  reason: 'ready',
};

export const gitlabProjects: GitLabProject[] = [
  {
    id: 'gitlab-project:encoded',
    name: 'acme/app',
    connectionId: 'a1b_acme',
    accountLabel: 'acme',
    defaultBranch: 'main',
  },
];

export function useGitLabHandlers(config: IntakeConfig, status: GitLabStatus = gitlabReadyStatus) {
  const saved = useIntakeHandlers({ config });
  const savedBindings: BindingUpdate[] = [];
  server.use(
    http.get(GITLAB_STATUS_URL, () => HttpResponse.json(status)),
    http.get(GITLAB_PROJECTS_URL, () => HttpResponse.json({ projects: gitlabProjects })),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Acme Web' }] }),
    ),
    http.get(BINDINGS_URL, () => HttpResponse.json({ bindings: savedBindings })),
    http.put<Record<string, never>, BindingUpdate>(BINDINGS_URL, async ({ request }) => {
      const body = await request.json();
      const index = savedBindings.findIndex(
        binding => binding.integrationId === body.integrationId && binding.sourceId === body.sourceId,
      );
      if (index === -1) savedBindings.push(body);
      else savedBindings[index] = body;
      return HttpResponse.json({ bindings: savedBindings });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:id/boards`, () =>
      HttpResponse.json({
        boards: [{ id: 'work', title: 'Work', initialPhase: 'intake', phases: [] }],
      }),
    ),
  );
  return { saved, savedBindings };
}

export function seedFactories() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          { id: FACTORY_A, name: 'Acme Web' },
          { id: FACTORY_B, name: 'Acme API' },
        ],
      }),
    ),
  );
}

export function renderIntakeSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/intake']}>
      <Routes>
        <Route path="/factories/:factoryId/settings/intake" element={<IntakeSection />} />
      </Routes>
      <Toaster position="bottom-right" />
    </MemoryRouter>,
  );
}

export async function openSourcePicker(label: string) {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(` to ${label}$`) }));
}

export async function closeSourcePicker() {
  const done = screen.getByRole('button', { name: 'Done' });
  await waitFor(() => expect(done).toBeEnabled());
  await userEvent.click(done);
}
