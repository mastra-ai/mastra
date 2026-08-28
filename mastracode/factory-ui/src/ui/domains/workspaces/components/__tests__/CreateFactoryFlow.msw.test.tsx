/**
 * BDD coverage for the inline `/factories/:factoryId/new-factory` wizard: Name →
 * VCS (GitHub repo) → Project management (Linear) → Model provider (default
 * model), each step rendered as a searchable command palette. Every pick lives
 * in a sessionStorage draft — so a full-page OAuth redirect resumes the flow,
 * and quitting halfway leaves nothing on the server — until the model step
 * commits the whole thing.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { GithubStatus } from '../../services/github';
import { CreateFactoryWizard } from '../create-factory/CreateFactoryWizard';

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const STEP_KEY = 'mastracode.factory-create.step';
const NAME_KEY = 'mastracode.factory-create.name';
const REPO_KEY = 'mastracode.factory-create.repository';
const FACTORY_KEY = 'mastracode.factory-create.factory-id';
const WIZARD_PATH = '/factories/fp-host/new-factory';

const connectedGithub: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 7, accountLogin: 'octo', accountType: 'User' }],
  reason: 'ready',
};

const repo = {
  id: 99,
  fullName: 'octo/hello',
  name: 'hello',
  owner: 'octo',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  repositoryStorageId: 'repo-99',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/hello',
};

function LocationProbe() {
  return <output data-testid="pathname">{useLocation().pathname}</output>;
}

function renderFlow(initialEntries: string[] = [WIZARD_PATH]) {
  return renderWithProviders(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
      <Routes>
        <Route path="/factories/:factoryId/new-factory" element={<CreateFactoryWizard />} />
        <Route path="*" element={<></>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('Create Factory wizard', () => {
  it('starts on the name step, with the create row disabled until a name is typed', async () => {
    server.use(http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })));

    renderFlow();

    expect(await screen.findByRole('heading', { name: 'Name your new Factory' })).toBeInTheDocument();
    expect(screen.getByLabelText('Factory name')).toHaveFocus();
    expect(screen.getByRole('option', { name: /Type a name to create your Factory/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await userEvent.setup().type(screen.getByLabelText('Factory name'), 'Mastra');
    expect(screen.getByRole('option', { name: /Create “Mastra”/ })).toHaveAttribute('aria-disabled', 'false');
  });

  it('carries the typed name to the repository step without creating anything yet', async () => {
    const creates: unknown[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.post(`${TEST_BASE_URL}/web/factory/projects`, async ({ request }) => {
        creates.push(await request.json());
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra' } });
      }),
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
    );
    const user = userEvent.setup();

    renderFlow();

    const field = await screen.findByLabelText('Factory name');
    await user.type(field, 'Mastra');
    await user.click(screen.getByRole('option', { name: /Create “Mastra”/ }));

    expect(await screen.findByRole('heading', { name: 'Choose your codebase' })).toBeInTheDocument();
    // The same field carries over, focused and empty — steps swap rows, not the palette.
    expect(screen.getByLabelText('Search repositories')).toBe(field);
    expect(field).toHaveFocus();
    expect(field).toHaveValue('');
    // Nothing exists server-side yet: quitting here leaves no empty Factory behind.
    expect(creates).toEqual([]);
    // Persisted for the GitHub OAuth round-trip.
    expect(sessionStorage.getItem(STEP_KEY)).toBe('vcs');
    expect(sessionStorage.getItem(NAME_KEY)).toBe('Mastra');
  });

  it('loads the repository list while the name is still being typed', async () => {
    let repoRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => {
        repoRequests += 1;
        return HttpResponse.json({ repos: [repo] });
      }),
    );
    const user = userEvent.setup();

    renderFlow();

    await screen.findByRole('heading', { name: 'Name your new Factory' });
    await waitFor(() => expect(repoRequests).toBe(1));

    await user.type(await screen.findByLabelText('Factory name'), 'Mastra{Enter}');

    // Already cached: the repository step opens on rows, not on a skeleton.
    expect(await screen.findByRole('heading', { name: 'Choose your codebase' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /octo\/hello/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading repositories')).not.toBeInTheDocument();
  });

  it('submits the typed name with Enter', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
    );
    const user = userEvent.setup();

    renderFlow();

    await user.type(await screen.findByLabelText('Factory name'), 'Mastra{Enter}');

    expect(await screen.findByRole('heading', { name: 'Choose your codebase' })).toBeInTheDocument();
  });

  it('keeps the picked repository in the draft instead of linking it right away', async () => {
    const calls: string[] = [];
    seedDraft('vcs');
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects`, () => {
        calls.push('create');
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra' } });
      }),
    );
    const user = userEvent.setup();

    renderFlow();

    await user.click(await screen.findByRole('option', { name: /octo\/hello/ }));

    expect(await screen.findByRole('heading', { name: 'Connect the work behind the code' })).toBeInTheDocument();
    expect(calls).toEqual([]);
    expect(sessionStorage.getItem(STEP_KEY)).toBe('project-management');
    expect(JSON.parse(sessionStorage.getItem(REPO_KEY) ?? 'null')).toMatchObject({ fullName: 'octo/hello' });
  });

  it('creates the Factory, links the repository and saves the model on the last step', async () => {
    const calls: string[] = [];
    seedDraft('project-management');
    const { patchedBodies, intakeConfigs } = stubModelStepEndpoints(calls);
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
      ),
    );
    const user = userEvent.setup();

    const { client } = renderFlow();

    await user.click(await screen.findByRole('button', { name: 'Skip' }));

    expect(await screen.findByRole('heading', { name: 'Choose your Factory model' })).toBeInTheDocument();
    expect(sessionStorage.getItem(STEP_KEY)).toBe('model-provider');
    // Still nothing server-side one step before the end.
    expect(calls).toEqual([]);

    await user.click(await screen.findByRole('option', { name: /Anthropic/ }));
    await user.click(await screen.findByRole('option', { name: /anthropic\/claude-sonnet-4-5/ }));

    await waitForMutationsIdle(client);
    expect(calls).toEqual(['create', 'connect', 'link']);
    expect(patchedBodies).toEqual([{ defaultModelId: 'anthropic/claude-sonnet-4-5' }]);
    // The picked repository feeds Work intake without a trip to Settings.
    expect(intakeConfigs).toEqual([
      { github: { enabled: true, sourceIds: ['octo/hello'] }, linear: { enabled: false, sourceIds: null } },
    ]);
    expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/fp-1');
    expect(sessionStorage.getItem(STEP_KEY)).toBeNull();
  });

  it('skips the intake write when the repository already feeds issue intake', async () => {
    const calls: string[] = [];
    seedDraft('model-provider');
    const { intakeConfigs } = stubModelStepEndpoints(calls, {
      github: { enabled: true, sourceIds: ['octo/hello'] },
    });
    const user = userEvent.setup();

    const { client } = renderFlow();

    await user.click(await screen.findByRole('option', { name: /Anthropic/ }));
    await user.click(await screen.findByRole('option', { name: /anthropic\/claude-sonnet-4-5/ }));

    await waitForMutationsIdle(client);
    // A retry or a second Factory over the same repo must not rewrite the selection.
    expect(intakeConfigs).toEqual([]);
  });

  it('resumes a failed commit without creating a second Factory', async () => {
    const calls: string[] = [];
    let linkFails = true;
    seedDraft('model-provider');
    const { patchedBodies } = stubModelStepEndpoints(calls);
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`, () => {
        if (linkFails) return HttpResponse.json({ error: 'nope' }, { status: 500 });
        calls.push('link');
        return HttpResponse.json({ projectRepository: linkedRepository });
      }),
    );
    const user = userEvent.setup();

    const { client } = renderFlow();

    await user.click(await screen.findByRole('option', { name: /Anthropic/ }));
    await user.click(await screen.findByRole('option', { name: /anthropic\/claude-sonnet-4-5/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(sessionStorage.getItem(FACTORY_KEY)).toBe('fp-1');

    linkFails = false;
    await user.click(screen.getByRole('option', { name: /anthropic\/claude-sonnet-4-5/ }));

    await waitForMutationsIdle(client);
    expect(patchedBodies).toHaveLength(1);
    // The Factory created by the first attempt is reused, not duplicated.
    expect(calls).toEqual(['create', 'connect', 'connect', 'link']);
  });

  it('freezes the picks a failed commit already wrote to the server', async () => {
    const calls: string[] = [];
    seedDraft('model-provider');
    stubModelStepEndpoints(calls);
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`, () =>
        HttpResponse.json({ error: 'nope' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();

    renderFlow();

    await user.click(await screen.findByRole('option', { name: /Anthropic/ }));
    await user.click(await screen.findByRole('option', { name: /anthropic\/claude-sonnet-4-5/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(sessionStorage.getItem(FACTORY_KEY)).toBe('fp-1');
    // The Factory exists: no walking back to rename it or swap the repository it will link.
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('cannot be left while the Factory is being created', async () => {
    const calls: string[] = [];
    seedDraft('model-provider');
    stubModelStepEndpoints(calls);
    server.use(http.post(`${TEST_BASE_URL}/web/factory/projects`, () => new Promise<never>(() => {})));
    const user = userEvent.setup();

    renderFlow();

    await user.click(await screen.findByRole('option', { name: /Anthropic/ }));
    await user.click(await screen.findByRole('option', { name: /anthropic\/claude-sonnet-4-5/ }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument());
    await user.keyboard('{Escape}');

    expect(screen.getByTestId('pathname')).toHaveTextContent(WIZARD_PATH);
  });

  it('offers to connect GitHub when no installation is reachable', async () => {
    seedDraft('vcs');
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
      ),
    );

    renderFlow();

    expect(await screen.findByRole('option', { name: /Connect GitHub/ })).toHaveAttribute('aria-disabled', 'false');
  });

  it('says so instead of offering a dead end when GitHub is not configured on the server', async () => {
    seedDraft('vcs');
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({
          enabled: false,
          connected: false,
          installations: [],
          reason: 'missing_config',
          diagnostics: { missingGithubAppEnvVars: ['GITHUB_APP_ID'] },
        }),
      ),
    );

    renderFlow();

    const row = await screen.findByRole('option', { name: /GitHub unavailable/ });
    expect(row).toHaveAttribute('aria-disabled', 'true');
    expect(row).toHaveTextContent('Set GITHUB_APP_ID on the server and restart.');
  });

  it('keeps the Linear step skippable when Linear is not configured on the server', async () => {
    seedDraft('project-management');
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: false, connected: false, workspace: null, reason: 'missing_config' }),
      ),
    );
    const user = userEvent.setup();

    renderFlow();

    expect(await screen.findByText('Linear is not configured for this deployment.')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Connect Linear/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: /Skip for now/ }));
    expect(await screen.findByRole('heading', { name: 'Choose your Factory model' })).toBeInTheDocument();
  });

  it('offers to reconnect Linear when its authorization expired', async () => {
    seedDraft('project-management');
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({
          enabled: true,
          connected: true,
          reason: 'ready',
          workspace: { name: 'Acme', urlKey: 'acme' },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/projects`, () =>
        HttpResponse.json(
          { error: 'linear_reauth_required', message: 'Linear authorization expired' },
          { status: 401 },
        ),
      ),
    );

    renderFlow();

    expect(await screen.findByRole('option', { name: /Reconnect Linear/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Skip for now/ })).toBeInTheDocument();
  });

  it('resumes at the stored step after an OAuth round-trip, listing the workspace projects', async () => {
    seedDraft('project-management');
    stubConnectedLinear();

    renderFlow();

    expect(await screen.findByRole('heading', { name: 'Connect the work behind the code' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /Mobile App/ })).toBeInTheDocument();
    // Skip leads, and doubles as chrome so a long project list never hides it.
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Skip for now');
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('routes the picked Linear project into the Factory it creates', async () => {
    const calls: string[] = [];
    seedDraft('project-management');
    stubConnectedLinear();
    const { intakeConfigs } = stubModelStepEndpoints(calls);
    const bindings: unknown[] = [];
    server.use(
      http.put(`${TEST_BASE_URL}/web/intake/bindings`, async ({ request }) => {
        bindings.push(await request.json());
        return HttpResponse.json({ bindings: [] });
      }),
    );
    const user = userEvent.setup();

    const { client } = renderFlow();

    await user.click(await screen.findByRole('option', { name: /Mobile App/ }));
    await user.click(await screen.findByRole('option', { name: /Anthropic/ }));
    await user.click(await screen.findByRole('option', { name: /anthropic\/claude-sonnet-4-5/ }));

    await waitForMutationsIdle(client);
    expect(bindings).toEqual([{ integrationId: 'linear', sourceId: 'lin-1', factoryProjectId: 'fp-1' }]);
    // Both picks land in one config write, each selected and switched on.
    expect(intakeConfigs).toEqual([
      { github: { enabled: true, sourceIds: ['octo/hello'] }, linear: { enabled: true, sourceIds: ['lin-1'] } },
    ]);
  });

  it('keeps Linear out of intake when it is skipped', async () => {
    const calls: string[] = [];
    seedDraft('project-management');
    stubConnectedLinear();
    const { intakeConfigs } = stubModelStepEndpoints(calls);
    const bindings: unknown[] = [];
    server.use(
      http.put(`${TEST_BASE_URL}/web/intake/bindings`, async ({ request }) => {
        bindings.push(await request.json());
        return HttpResponse.json({ bindings: [] });
      }),
    );
    const user = userEvent.setup();

    const { client } = renderFlow();

    await user.click(await screen.findByRole('button', { name: 'Skip' }));
    await user.click(await screen.findByRole('option', { name: /Anthropic/ }));
    await user.click(await screen.findByRole('option', { name: /anthropic\/claude-sonnet-4-5/ }));

    await waitForMutationsIdle(client);
    expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/fp-1');
    // No Linear routing without a picked project; only the repository feeds intake.
    expect(bindings).toEqual([]);
    expect(intakeConfigs).toEqual([
      { github: { enabled: true, sourceIds: ['octo/hello'] }, linear: { enabled: false, sourceIds: null } },
    ]);
  });

  it('restarts at the name step when the stored draft has no repository to commit', async () => {
    sessionStorage.setItem(STEP_KEY, 'model-provider');
    sessionStorage.setItem(NAME_KEY, 'Mastra');
    sessionStorage.setItem(FACTORY_KEY, 'fp-ghost');
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
    );
    const user = userEvent.setup();

    renderFlow();

    expect(await screen.findByRole('heading', { name: 'Name your new Factory' })).toBeInTheDocument();

    // Restarting drops what an earlier attempt half-created, so the run ahead is a clean one.
    await user.click(screen.getByRole('option', { name: /Create “Mastra”/ }));
    await screen.findByRole('heading', { name: 'Choose your codebase' });
    expect(sessionStorage.getItem(FACTORY_KEY)).toBeNull();
  });

  it('shows the server error inline when the final create fails', async () => {
    seedDraft('model-provider');
    stubModelStepEndpoints([]);
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ error: 'Factory creation is unavailable' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();

    renderFlow();

    await user.click(await screen.findByRole('option', { name: /Anthropic/ }));
    await user.click(await screen.findByRole('option', { name: /anthropic\/claude-sonnet-4-5/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to create Factory (500)');
    expect(screen.getByRole('heading', { name: 'Choose your Factory model' })).toBeInTheDocument();
  });

  it('Back steps through the wizard, and leaves it from the first step', async () => {
    sessionStorage.setItem(STEP_KEY, 'vcs');
    sessionStorage.setItem(NAME_KEY, 'Mastra');
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
      http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
      http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
    );
    const user = userEvent.setup();

    renderFlow(['/factories/fp-host/overview', WIZARD_PATH]);

    await user.click(await screen.findByRole('button', { name: 'Back' }));

    // Back to the name step, with what was already typed.
    expect(await screen.findByRole('heading', { name: 'Name your new Factory' })).toBeInTheDocument();
    expect(screen.getByLabelText('Factory name')).toHaveValue('Mastra');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/fp-host/overview'));
  });

  it('Escape falls back to the Factory in view when there is no in-app history (deep link)', async () => {
    server.use(http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })));
    const user = userEvent.setup();

    renderFlow();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/fp-host'));
  });
});

const linkedRepository = {
  id: 'ghp_1',
  branch: 'main',
  sandboxWorkdir: '/workspace/hello',
  repository: { slug: 'octo/hello', defaultBranch: 'main' },
};

/**
 * Stub the intake config the last step reads and writes, collecting every
 * saved config body.
 */
function stubIntakeConfig(config: Record<string, unknown> = {}) {
  const savedConfigs: unknown[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config })),
    http.put(`${TEST_BASE_URL}/web/intake/config`, async ({ request }) => {
      savedConfigs.push(await request.json());
      return HttpResponse.json({ config });
    }),
  );
  return savedConfigs;
}

/**
 * Stub everything the last step writes: the Factory create, the repository
 * link, the intake wiring, the PATCH that saves the model pick and the hidden
 * OM provider-defaults save — plus the provider catalog the step lists. `calls`
 * records the write order; the returned arrays collect the PATCH and intake
 * bodies.
 */
function stubModelStepEndpoints(calls: string[], intakeConfig: Record<string, unknown> = {}) {
  const patchedBodies: unknown[] = [];
  const intakeConfigs = stubIntakeConfig(intakeConfig);
  let savedModelId: string | null = null;
  let created = false;
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: created ? [{ id: 'fp-1', name: 'Mastra' }] : [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects`, () => {
      calls.push('create');
      created = true;
      return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra' } });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
      HttpResponse.json({ connections: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () => {
      calls.push('connect');
      return HttpResponse.json({ connection: { id: 'conn-1' } });
    }),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections/conn-1/repositories`,
      async ({ request }) => {
        calls.push('link');
        expect(await request.json()).toMatchObject({ repositoryId: 'repo-99', branch: 'main' });
        return HttpResponse.json({ projectRepository: linkedRepository });
      },
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
      HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: savedModelId } }),
    ),
    http.patch<never, { defaultModelId: string | null }>(
      `${TEST_BASE_URL}/web/factory/projects/fp-1`,
      async ({ request }) => {
        const body = await request.json();
        patchedBodies.push(body);
        savedModelId = body.defaultModelId;
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', defaultModelId: savedModelId } });
      },
    ),
    http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
      HttpResponse.json({
        providers: [{ provider: 'anthropic', source: 'stored', oauth: { supported: true, modes: ['paste-code'] } }],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: [
          { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
        ],
      }),
    ),
    http.post(`${TEST_BASE_URL}/web/config/om/provider-defaults`, () => HttpResponse.json({ ok: true, config: {} })),
  );
  return { patchedBodies, intakeConfigs };
}

function stubConnectedLinear() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({
        enabled: true,
        connected: true,
        reason: 'ready',
        workspace: { name: 'Acme', urlKey: 'acme' },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/projects`, () =>
      HttpResponse.json({
        projects: [
          { id: 'lin-1', name: 'Mobile App', state: 'started', teams: [{ id: 't1', key: 'ENG', name: 'Engineering' }] },
        ],
      }),
    ),
  );
}

/** Seed a mid-flow draft: name typed, repository picked, nothing created yet. */
function seedDraft(step: 'vcs' | 'project-management' | 'model-provider') {
  sessionStorage.setItem(STEP_KEY, step);
  sessionStorage.setItem(NAME_KEY, 'Mastra');
  if (step !== 'vcs') sessionStorage.setItem(REPO_KEY, JSON.stringify(repo));
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
    http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedGithub)),
    http.get(`${TEST_BASE_URL}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
  );
}
