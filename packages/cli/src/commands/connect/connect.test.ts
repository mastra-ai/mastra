import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/credentials.js', () => ({
  getToken: vi.fn().mockResolvedValue('tok'),
  openBrowser: vi.fn(),
}));
vi.mock('../auth/orgs.js', () => ({
  resolveCurrentOrg: vi.fn().mockResolvedValue({ orgId: 'org_1', orgName: 'Org' }),
}));
vi.mock('../env/resolve-project.js', () => ({
  resolveProject: vi.fn().mockResolvedValue({ id: 'proj_1', name: 'My Project' }),
}));
vi.mock('./api.js', () => ({
  fetchIntegrationCatalog: vi.fn(),
  fetchProjectConnections: vi.fn(),
  fetchOrgMembers: vi.fn(),
  createProjectConnectSession: vi.fn(),
  removeProjectConnection: vi.fn(),
}));

import { fetchIntegrationCatalog, fetchOrgMembers, fetchProjectConnections } from './api.js';
import { listProvidersAction } from './connect.js';

function connection(overrides: Record<string, unknown>) {
  return {
    id: 'conn_1',
    integrationId: 'linear',
    status: 'active',
    accountLabel: null,
    displayName: null,
    connectedByUserId: 'user_1',
    connectedAt: null,
    ...overrides,
  };
}

describe('listProvidersAction', () => {
  let output: string[];

  beforeEach(() => {
    output = [];
    vi.spyOn(console, 'info').mockImplementation((line: string) => void output.push(line));
    vi.mocked(fetchIntegrationCatalog).mockResolvedValue([
      { id: 'linear', displayName: 'Linear', logoUrl: null, authType: 'OAUTH2', authFields: [], comingSoon: false },
      { id: 'slack', displayName: 'Slack', logoUrl: null, authType: 'OAUTH2', authFields: [], comingSoon: false },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the account label when present without fetching members', async () => {
    vi.mocked(fetchProjectConnections).mockResolvedValue([connection({ accountLabel: 'charlie@mastra.ai' })]);

    await listProvidersAction();

    expect(output.join('\n')).toContain('connected (charlie@mastra.ai)');
    expect(fetchOrgMembers).not.toHaveBeenCalled();
  });

  it('falls back to "connected by <member name>" when the label is null', async () => {
    vi.mocked(fetchProjectConnections).mockResolvedValue([connection({})]);
    vi.mocked(fetchOrgMembers).mockResolvedValue([
      { userId: 'user_1', email: 'charlie@mastra.ai', firstName: 'Charlie', lastName: 'Smith' },
    ]);

    await listProvidersAction();

    expect(output.join('\n')).toContain('connected by Charlie Smith');
  });

  it('falls back to the member email when no name is set', async () => {
    vi.mocked(fetchProjectConnections).mockResolvedValue([connection({})]);
    vi.mocked(fetchOrgMembers).mockResolvedValue([
      { userId: 'user_1', email: 'charlie@mastra.ai', firstName: null, lastName: null },
    ]);

    await listProvidersAction();

    expect(output.join('\n')).toContain('connected by charlie@mastra.ai');
  });

  it('still renders when the connecting member is unknown', async () => {
    vi.mocked(fetchProjectConnections).mockResolvedValue([connection({ connectedByUserId: 'user_gone' })]);
    vi.mocked(fetchOrgMembers).mockResolvedValue([]);

    await listProvidersAction();

    expect(output.join('\n')).toContain('connected by a teammate');
  });
});
