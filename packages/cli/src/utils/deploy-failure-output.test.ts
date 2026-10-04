import { afterEach, describe, expect, it, vi } from 'vitest';

const ids = { orgId: 'org_1', projectId: 'proj_1', deployId: 'dep_1' };

describe('deployDashboardUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('links environment deploys under the project deploys route', async () => {
    const { deployDashboardUrl } = await import('./deploy-failure-output.js');
    expect(deployDashboardUrl('environment', ids)).toBe(
      'https://projects.mastra.ai/orgs/org_1/projects/proj_1/deploys/dep_1',
    );
  });

  it('keeps the environment in the path when one is known', async () => {
    const { deployDashboardUrl } = await import('./deploy-failure-output.js');
    expect(deployDashboardUrl('environment', { ...ids, envId: 'env_1' })).toBe(
      'https://projects.mastra.ai/orgs/org_1/projects/proj_1/environments/env_1/deploys/dep_1',
    );
  });

  it('links server deploys under server-deploys without a product segment', async () => {
    const { deployDashboardUrl } = await import('./deploy-failure-output.js');
    expect(deployDashboardUrl('server', ids)).toBe(
      'https://projects.mastra.ai/orgs/org_1/projects/proj_1/server-deploys/dep_1',
    );
  });

  it('uses the staging dashboard when the platform API is staging', async () => {
    vi.stubEnv('MASTRA_PROJECTS_URL', '');
    vi.stubEnv('MASTRA_PLATFORM_API_URL', 'https://platform.staging.mastra.ai');
    const { deployDashboardUrl } = await import('./deploy-failure-output.js');
    expect(deployDashboardUrl('environment', ids)).toBe(
      'https://projects.staging.mastra.ai/orgs/org_1/projects/proj_1/deploys/dep_1',
    );
  });

  it('prefers an explicit dashboard host', async () => {
    vi.stubEnv('MASTRA_PROJECTS_URL', 'http://localhost:5173');
    vi.stubEnv('MASTRA_PLATFORM_API_URL', 'https://platform.staging.mastra.ai');
    const { deployDashboardUrl } = await import('./deploy-failure-output.js');
    expect(deployDashboardUrl('server', ids)).toBe(
      'http://localhost:5173/orgs/org_1/projects/proj_1/server-deploys/dep_1',
    );
  });
});
