import { http, HttpResponse, delay } from 'msw';
import { z } from 'zod';
import type { PlatformProviderConnection } from '../src/ui/domains/factory/services/platformConnect';
import type { AvailableModelOption } from '../src/hooks/useAvailableModels';
import type { ProviderInfo } from '../src/api/types';
import { gitLabProjectRepository } from '../src/ui/domains/factory/services/gitlab';
import type { GitLabProject } from '../src/ui/domains/factory/services/gitlab';
import type { GithubRepo, GithubStatus } from '../src/ui/domains/workspaces/services/github';
import { modelSetupPresetSchema } from '../src/ui/domains/workspaces/services/modelSetupPreset';
import type { SaveModelSetupPreset } from '../src/ui/domains/workspaces/services/modelSetupPreset';

const prefix = 'factory-onboarding-preview.';
export const demoKey = (key: string) => `${prefix}${key}`;
// Deliberately preview-only: the production API does not enforce these policies yet.
export const saveDemoModelSetupPreset: SaveModelSetupPreset = async (factoryId, preset) => {
  const response = await fetch(`/preview/factories/${encodeURIComponent(factoryId)}/model-setup`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  if (!response.ok) throw new Error('Unable to save the preview setup. Please try again.');
};
const repos: GithubRepo[] = ['atlas', 'dashboard', 'design-system'].map((name, index) => ({
  id: 100 + index,
  name,
  fullName: `acme/${name}`,
  owner: 'acme',
  defaultBranch: index === 1 ? 'develop' : 'main',
  private: index !== 2,
  installationId: 7,
  installationStorageId: 'demo-installation',
  sandboxProvider: 'local',
  sandboxWorkdir: `/workspace/${name}`,
}));
const gitlabProjects: GitLabProject[] = ['platform-api', 'customer-portal'].map((name, index) => ({
  id: `gitlab-source-${index}`,
  name,
  projectId: String(200 + index),
  projectPath: `acme/${name}`,
  installationStorageId: 'demo-gitlab-installation',
  defaultBranch: index === 0 ? 'main' : 'develop',
  sandboxProvider: 'local',
  sandboxWorkdir: `/workspace/${name}`,
}));
const gitlabRepos = gitlabProjects.flatMap(project => {
  const repo = gitLabProjectRepository(project);
  return repo ? [repo] : [];
});
const models: AvailableModelOption[] = [
  { id: 'openai/gpt-5.6-sol', provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true },
  { id: 'openai/gpt-6.1-sol', provider: 'openai', modelName: 'gpt-6.1-sol', hasApiKey: true },
  { id: 'anthropic/claude-fable-5', provider: 'anthropic', modelName: 'claude-fable-5', hasApiKey: true },
];
const selectedRepo = () =>
  [...repos, ...gitlabRepos].find(repo => repo.name === sessionStorage.getItem(demoKey('name'))) ?? repos[0]!;
const project = () => ({
  id: 'preview-factory',
  name: selectedRepo().name,
  defaultModelId: sessionStorage.getItem(demoKey('model')),
});
const repository = () => ({
  id: 'preview-repository',
  branch: selectedRepo().defaultBranch,
  sandboxWorkdir: selectedRepo().sandboxWorkdir,
  repository: {
    externalId: String(selectedRepo().id),
    slug: selectedRepo().fullName,
    defaultBranch: selectedRepo().defaultBranch,
  },
});
const providers = (): ProviderInfo[] =>
  ['openai', 'anthropic'].map(provider => ({
    provider,
    envVar: provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY',
    source: 'stored-org',
    orgCredential: sessionStorage.getItem(demoKey(`org-${provider}`)) === 'oauth' ? 'oauth' : 'api_key',
    orgKey: sessionStorage.getItem(demoKey(`org-${provider}`)) !== 'oauth',
    oauth: { supported: true, modes: ['paste-code'] },
    ...(sessionStorage.getItem(demoKey(`personal-${provider}`))
      ? {
          userCredential:
            sessionStorage.getItem(demoKey(`personal-${provider}`)) === 'oauth'
              ? ('oauth' as const)
              : ('api_key' as const),
        }
      : {}),
  }));

export function resetDemo() {
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith(prefix) || key.startsWith('mastracode.factory-onboarding.')) sessionStorage.removeItem(key);
  }
  window.location.assign('/');
}

export const handlers = [
  http.put('*/preview/factories/:id/model-setup', async ({ request }) => {
    const result = modelSetupPresetSchema.safeParse(await request.json());
    if (!result.success) return HttpResponse.json({ error: 'Invalid preset' }, { status: 400 });
    sessionStorage.setItem(demoKey('model-setup'), JSON.stringify(result.data));
    return HttpResponse.json({ ok: true });
  }),
  http.get('*/auth/me', () =>
    HttpResponse.json({ authEnabled: true, authenticated: true, user: { userId: 'preview-user', name: 'Alex' } }),
  ),
  http.get('*/auth/:provider/connect', ({ params }) =>
    HttpResponse.redirect(`${location.origin}/?demo-connect=${params.provider}`),
  ),
  http.get('*/web/github/status', () => {
    const connected = sessionStorage.getItem(demoKey('github')) === 'true';
    const status: GithubStatus = {
      enabled: true,
      connected,
      reason: connected ? 'ready' : 'not_connected',
      installations: connected ? [{ installationId: 7, accountLogin: 'acme', accountType: 'Organization' }] : [],
    };
    return HttpResponse.json(status);
  }),
  http.get('*/web/github/repos', ({ request }) => {
    const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? '';
    return HttpResponse.json({ repos: repos.filter(repo => repo.fullName.includes(q)) });
  }),
  http.get('*/web/gitlab/status', () =>
    HttpResponse.json({ enabled: true, configured: true, reauthRequired: false, reason: 'ready', accounts: ['Acme'] }),
  ),
  http.get('*/web/gitlab/projects', () => HttpResponse.json({ projects: gitlabProjects })),
  http.post('*/web/gitlab/projects/registration', async ({ request }) => {
    const body = await request.json();
    const sourceId = body && typeof body === 'object' && 'sourceId' in body ? body.sourceId : undefined;
    const project = gitlabProjects.find(item => item.id === sourceId);
    return project
      ? HttpResponse.json({ project })
      : HttpResponse.json({ error: 'Unknown GitLab project' }, { status: 404 });
  }),
  http.get('*/web/factory/projects', () =>
    HttpResponse.json({ projects: sessionStorage.getItem(demoKey('name')) ? [project()] : [] }),
  ),
  http.post('*/web/factory/projects', async ({ request }) => {
    const body = await request.json();
    if (body && typeof body === 'object' && 'name' in body && typeof body.name === 'string')
      sessionStorage.setItem(demoKey('name'), body.name);
    await delay(250);
    return HttpResponse.json({ project: project() });
  }),
  http.get('*/web/factory/projects/:id/source-control-connections', () =>
    HttpResponse.json({
      connections: sessionStorage.getItem(demoKey('linked'))
        ? [
            {
              id: 'preview-connection',
              installationId: sessionStorage.getItem(demoKey('installation')) ?? 'demo-installation',
              integrationId: sessionStorage.getItem(demoKey('vcs')) ?? 'github',
              repositories: [repository()],
            },
          ]
        : [],
    }),
  ),
  http.post('*/web/factory/projects/:id/source-control-connections', async ({ request }) => {
    const body = await request.json();
    if (body && typeof body === 'object') {
      if ('integrationId' in body && typeof body.integrationId === 'string')
        sessionStorage.setItem(demoKey('vcs'), body.integrationId);
      if ('installationId' in body && typeof body.installationId === 'string')
        sessionStorage.setItem(demoKey('installation'), body.installationId);
    }
    return HttpResponse.json({ connection: { id: 'preview-connection' } });
  }),
  http.post('*/web/factory/projects/:id/source-control-connections/:connection/repositories', () => {
    sessionStorage.setItem(demoKey('linked'), 'true');
    return HttpResponse.json({ projectRepository: repository() });
  }),
  http.patch('*/web/factory/projects/:id', async ({ request }) => {
    const body = await request.json();
    if (body && typeof body === 'object' && 'name' in body && typeof body.name === 'string')
      sessionStorage.setItem(demoKey('name'), body.name);
    if (body && typeof body === 'object' && 'defaultModelId' in body && typeof body.defaultModelId === 'string')
      sessionStorage.setItem(demoKey('model'), body.defaultModelId);
    if (body && typeof body === 'object' && 'defaultModelId' in body && body.defaultModelId === null)
      sessionStorage.removeItem(demoKey('model'));
    return HttpResponse.json({ project: project() });
  }),
  http.get('*/web/intake/config', () => HttpResponse.json({ config: {} })),
  http.put('*/web/intake/config', async ({ request }) => HttpResponse.json({ config: await request.json() })),
  http.get('*/web/linear/status', () => {
    const connected = sessionStorage.getItem(demoKey('linear')) === 'true';
    return HttpResponse.json({
      enabled: true,
      connected,
      reason: connected ? 'ready' : 'not_connected',
      ...(connected ? { workspace: { id: 'demo', name: 'Acme' } } : {}),
    });
  }),
  http.get('*/web/integrations/platform/:provider/connections', ({ params }) => {
    const provider = String(params.provider);
    const connected = sessionStorage.getItem(demoKey(`platform-${provider}`)) === 'active';
    const connections: PlatformProviderConnection[] = connected
      ? [
          {
            id: `demo-${provider}`,
            integrationId: provider,
            status: 'active',
            accountLabel: provider === 'jira' ? 'acme.atlassian.net' : 'Acme',
          },
        ]
      : [];
    return HttpResponse.json({ connections });
  }),
  http.post('*/web/integrations/platform/:provider/connect-session', ({ params }) =>
    HttpResponse.json({
      connectionId: `demo-${params.provider}`,
      integrationId: params.provider,
      connectUrl: `${location.origin}/`,
      sessionToken: `preview-${params.provider}`,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }),
  ),
  http.post('*/preview/platform/authorize', async ({ request }) => {
    const result = z
      .object({
        integrationId: z.enum(['jira', 'incident-io', 'gitlab']),
        sessionToken: z.string(),
      })
      .safeParse(await request.json());
    if (!result.success || result.data.sessionToken !== `preview-${result.data.integrationId}`)
      return HttpResponse.json({ error: 'Unknown demo session' }, { status: 400 });
    await delay(350);
    sessionStorage.setItem(demoKey(`platform-${result.data.integrationId}`), 'active');
    return HttpResponse.json({ ok: true });
  }),
  http.get('*/web/config/providers', () => HttpResponse.json({ providers: providers(), orgKeyAdmin: true })),
  http.get('*/web/config/models', () => HttpResponse.json({ models })),
  http.get('*/web/config/default-model', () =>
    HttpResponse.json({ modelId: sessionStorage.getItem(demoKey('personal-model')) }),
  ),
  http.put('*/web/config/default-model', async ({ request }) => {
    const body = await request.json();
    if (!body || typeof body !== 'object' || !('modelId' in body) || typeof body.modelId !== 'string')
      return HttpResponse.json({ error: 'Choose a model' }, { status: 400 });
    sessionStorage.setItem(demoKey('personal-model'), body.modelId);
    return HttpResponse.json({ ok: true, modelId: body.modelId });
  }),
  http.put('*/web/config/providers/:provider/key', async ({ params, request }) => {
    // Read only the scope; never persist or send the submitted demo key anywhere.
    const body = await request.json();
    const scope = body && typeof body === 'object' && 'scope' in body && body.scope === 'org' ? 'org' : 'personal';
    sessionStorage.setItem(demoKey(`${scope}-${params.provider}`), 'api_key');
    return HttpResponse.json({ success: true });
  }),
  http.post('*/web/config/providers/:provider/oauth/start', async ({ params, request }) => {
    const body = await request.json();
    const scope = body && typeof body === 'object' && 'scope' in body && body.scope === 'org' ? 'org' : 'personal';
    sessionStorage.setItem(demoKey(`oauth-scope-${params.provider}`), scope);
    return HttpResponse.json({
      sessionId: `demo-${params.provider}`,
      kind: 'paste-code',
      url: `${location.origin}/?demo-provider=${params.provider}`,
      instructions: 'Preview only: enter DEMO to simulate provider sign-in. No real account is connected.',
      expiresAt: Date.now() + 600_000,
    });
  }),
  http.post('*/web/config/providers/:provider/oauth/complete', ({ params }) => {
    const scope = sessionStorage.getItem(demoKey(`oauth-scope-${params.provider}`)) ?? 'personal';
    sessionStorage.setItem(demoKey(`${scope}-${params.provider}`), 'oauth');
    return HttpResponse.json({ status: 'complete' });
  }),
  http.delete('*/web/config/providers/:provider/oauth/session/:session', () => HttpResponse.json({ ok: true })),
  http.all('*/web/*', () =>
    HttpResponse.json({ error: 'This action is outside the onboarding preview.' }, { status: 404 }),
  ),
];
