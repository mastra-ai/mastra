import path from 'node:path';
import process from 'node:process';
import * as p from '@clack/prompts';
import {
  MASTRA_PLATFORM_API_URL,
  authHeaders,
  extractApiErrorDetail,
  fetchOrgs,
  getToken,
  loadCredentials,
  platformFetch,
} from 'mastra/internal/auth';
import { x } from 'tinyexec';

import {
  type DatabaseSettings,
  type FactoryDevSettings,
  loadEnvironmentValue,
  loadSettings,
  localPostgresUrl,
  saveEnvironment,
  saveSettings,
} from './settings.js';

interface Project {
  id: string;
  name: string;
  slug: string | null;
}

interface Environment {
  id: string;
  name: string;
  slug: string;
  type: string;
}

interface PlatformDatabase {
  id: string;
  name: string;
  kind: string;
  status: string;
}

const root = path.resolve(import.meta.dirname, '../../../..');
const webDir = path.resolve(import.meta.dirname, '../..');

async function apiJson<T>(url: string, token: string, orgId: string): Promise<T> {
  const response = await platformFetch(url, { headers: authHeaders(token, orgId) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(extractApiErrorDetail(body) || `Platform request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

async function mintOrgApiKey(token: string, orgId: string, projectName: string): Promise<string> {
  const response = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/tokens`, {
    method: 'POST',
    headers: { ...authHeaders(token, orgId), 'content-type': 'application/json' },
    body: JSON.stringify({ name: `factory-dev: ${projectName}` }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(extractApiErrorDetail(body) || `Failed to create platform API key (${response.status})`);
  }
  const body = (await response.json()) as { secret?: string };
  if (!body.secret) throw new Error('Platform did not return the new API key.');
  return body.secret;
}

async function choose<T extends string>(
  message: string,
  options: Parameters<typeof p.select<T>>[0]['options'],
): Promise<T> {
  const result = await p.select<T>({ message, options });
  if (p.isCancel(result)) {
    p.cancel('Factory setup cancelled.');
    process.exit(0);
  }
  return result as T;
}

async function configure(): Promise<FactoryDevSettings> {
  p.intro('Factory local development setup');
  if (!process.env.MASTRA_API_TOKEN && !(await loadCredentials())) {
    p.log.info('A browser window will open so you can sign in to Mastra.');
  }
  const token = await getToken();

  const orgs = await fetchOrgs(token);
  if (orgs.length === 0) throw new Error('Your Mastra account has no accessible organizations.');
  const orgId =
    orgs.length === 1
      ? orgs[0]!.id
      : await choose(
          'Select an organization',
          orgs.map(org => ({ value: org.id, label: org.name, hint: org.id })),
        );
  const organization = orgs.find(org => org.id === orgId)!;

  const projects = await apiJson<{ projects: Project[] }>(`${MASTRA_PLATFORM_API_URL}/v1/projects`, token, orgId).then(
    result => result.projects,
  );
  if (projects.length === 0) throw new Error('The selected organization has no projects. Create one in Mastra Cloud first.');
  const projectId =
    projects.length === 1
      ? projects[0]!.id
      : await p.autocomplete({
          message: 'Select a project',
          placeholder: 'Type to search projects...',
          maxItems: 10,
          options: projects.map(project => ({
            value: project.id,
            label: project.name,
            hint: project.slug || project.id,
          })),
        });
  if (p.isCancel(projectId)) {
    p.cancel('Factory setup cancelled.');
    process.exit(0);
  }
  const project = projects.find(item => item.id === projectId)!;

  const environments = await apiJson<{ environments: Environment[] }>(
    `${MASTRA_PLATFORM_API_URL}/v1/projects/${encodeURIComponent(projectId)}/environments`,
    token,
    orgId,
  ).then(result => result.environments);
  if (environments.length === 0) throw new Error('The selected project has no environments.');
  const preferredEnvironment = environments.find(environment => environment.type === 'production') ?? environments[0]!;
  const environmentId =
    environments.length === 1
      ? preferredEnvironment.id
      : await choose(
          'Select a project environment',
          environments.map(environment => ({
            value: environment.id,
            label: environment.name,
            hint: environment.type,
          })),
        );
  const environment = environments.find(item => item.id === environmentId)!;

  const databaseProvider = await choose('Select a database', [
    { value: 'libsql', label: 'LibSQL', hint: 'Local file, no Docker' },
    { value: 'postgres-local', label: 'PostgreSQL', hint: 'Local Docker container' },
    { value: 'platform', label: 'Platform-managed', hint: 'Use a database attached to the selected project' },
  ] as const);

  let database: DatabaseSettings;
  if (databaseProvider === 'platform') {
    const databases = await apiJson<{ databases: PlatformDatabase[] }>(
      `${MASTRA_PLATFORM_API_URL}/v1/server/projects/${encodeURIComponent(projectId)}/databases`,
      token,
      orgId,
    ).then(result => result.databases.filter(item => item.status === 'ready' && item.kind === 'neon'));
    if (databases.length === 0) {
      throw new Error('The selected project has no ready platform-managed PostgreSQL databases.');
    }
    const databaseId = await choose(
      'Select a platform-managed database',
      databases.map(item => ({ value: item.id, label: item.name, hint: item.kind })),
    );
    database = { provider: 'platform', databaseId };
  } else {
    database = { provider: databaseProvider };
  }

  const sandboxProvider = await choose('Select a sandbox provider', [
    { value: 'local', label: 'Local', hint: 'Runs commands on this machine' },
    { value: 'platform', label: 'Platform', hint: 'Uses the selected project environment' },
  ] as const);

  if (database.provider === 'postgres-local') {
    const spinner = p.spinner();
    spinner.start('Starting PostgreSQL and Redis with Docker');
    const result = await x('pnpm', ['db:up'], { nodeOptions: { cwd: webDir, stdio: 'pipe' } });
    if (result.exitCode !== 0) {
      spinner.stop('Docker services failed to start');
      throw new Error(result.stderr || 'Docker is unavailable. Start Docker Desktop and run pnpm factory:dev again.');
    }
    spinner.stop('PostgreSQL and Redis are ready');
  }

  const settings: FactoryDevSettings = {
    version: 1,
    auth: { source: 'mastra-cli-session' },
    organization,
    project: { id: project.id, name: project.name },
    environment: { id: environment.id, name: environment.name },
    database,
    sandbox: { provider: sandboxProvider },
  };
  await saveSettings(root, settings);
  p.outro('Saved local configuration to .factory/settings.json');
  return settings;
}

async function resolveEnvironment(settings: FactoryDevSettings): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MASTRA_ORGANIZATION_ID: settings.organization.id,
    MASTRA_PROJECT_ID: settings.project.id,
    MASTRA_ENVIRONMENT_ID: settings.environment.id,
    FACTORY_SANDBOX_PROVIDER: settings.sandbox.provider === 'local' ? 'local' : undefined,
  };

  delete env.MASTRA_PLATFORM_ACCESS_TOKEN;
  if (settings.database.provider === 'postgres-local') {
    env.DATABASE_URL = localPostgresUrl(env);
    env.REDIS_URL ||= 'redis://localhost:63799';
  } else if (settings.database.provider === 'platform') {
    const result = await apiJson<{ envVars: { name: string; value: string }[] }>(
      `${MASTRA_PLATFORM_API_URL}/v1/server/projects/${encodeURIComponent(settings.project.id)}/databases/${encodeURIComponent(settings.database.databaseId)}/connection`,
      await getToken(),
      settings.organization.id,
    );
    const databaseUrl = result.envVars.find(item => item.name === 'DATABASE_URL')?.value;
    if (!databaseUrl) throw new Error('The platform-managed database did not provide DATABASE_URL.');
    env.DATABASE_URL = databaseUrl;
  } else {
    delete env.DATABASE_URL;
    delete env.APP_DATABASE_URL;
  }
  return env;
}

async function run() {
  const existingSettings = await loadSettings(root);
  const settings = existingSettings ?? (await configure());
  if (settings.database.provider === 'postgres-local') {
    const result = await x('pnpm', ['db:up'], { nodeOptions: { cwd: webDir, stdio: 'inherit' } });
    if (result.exitCode !== 0) process.exit(result.exitCode);
  }
  const env = await resolveEnvironment(settings);
  const envFile = path.join(webDir, '.env');
  let platformSecretKey = existingSettings
    ? await loadEnvironmentValue(envFile, 'MASTRA_PLATFORM_SECRET_KEY')
    : undefined;
  if (!platformSecretKey) {
    const spinner = p.spinner();
    spinner.start('Creating organization-scoped platform API key');
    try {
      platformSecretKey = await mintOrgApiKey(await getToken(), settings.organization.id, settings.project.name);
      spinner.stop('Platform API key created');
    } catch (error) {
      spinner.stop('Platform API key creation failed');
      throw error;
    }
  }
  env.MASTRA_PLATFORM_SECRET_KEY = platformSecretKey;
  delete env.MASTRA_PLATFORM_ACCESS_TOKEN;
  await saveEnvironment(envFile, {
    MASTRA_PLATFORM_ACCESS_TOKEN: undefined,
    MASTRA_PLATFORM_SECRET_KEY: env.MASTRA_PLATFORM_SECRET_KEY,
    MASTRA_ORGANIZATION_ID: env.MASTRA_ORGANIZATION_ID,
    MASTRA_PROJECT_ID: env.MASTRA_PROJECT_ID,
    MASTRA_ENVIRONMENT_ID: env.MASTRA_ENVIRONMENT_ID,
    FACTORY_SANDBOX_PROVIDER: env.FACTORY_SANDBOX_PROVIDER,
    DATABASE_URL: env.DATABASE_URL,
    REDIS_URL: settings.database.provider === 'postgres-local' ? env.REDIS_URL : undefined,
  });
  const dev = await x(
    'pnpm',
    ['turbo', 'run', 'dev', 'dev:api', '--filter', './mastracode/factory-ui', '--filter', './packages/playground-ui', '--env-mode=loose'],
    { nodeOptions: { cwd: root, stdio: 'inherit', env } },
  );
  process.exit(dev.exitCode ?? 1);
}

run().catch(error => {
  p.log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
