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
  fetchOrgConnections: vi.fn(),
  fetchOrgMembers: vi.fn(),
  addConnectionToProject: vi.fn(),
  createProjectConnectSession: vi.fn(),
  removeProjectConnection: vi.fn(),
  updateConnectionDisplayName: vi.fn(),
}));

const CANCEL = Symbol('cancel');
vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  confirm: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  isCancel: (value: unknown) => value === CANCEL,
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
}));

import { confirm, select, text } from '@clack/prompts';

import {
  addConnectionToProject,
  createProjectConnectSession,
  fetchIntegrationCatalog,
  fetchOrgConnections,
  fetchOrgMembers,
  fetchProjectConnections,
  updateConnectionDisplayName,
} from './api.js';
import { connectProviderAction, listProvidersAction } from './connect.js';

function connection(overrides: Record<string, unknown>) {
  return {
    id: 'conn_1',
    integrationId: 'linear',
    status: 'active',
    accountLabel: null,
    displayName: null,
    connectedByUserId: 'user_1',
    connectedAt: null,
    createdAt: '2026-09-25T14:41:21.878Z',
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

describe('connectProviderAction', () => {
  let output: string[];
  const originalStdinTTY = process.stdin.isTTY;
  const originalStdoutTTY = process.stdout.isTTY;
  const originalCI = process.env.CI;

  beforeEach(() => {
    output = [];
    vi.spyOn(console, 'info').mockImplementation((line: string) => void output.push(line));
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    delete process.env.CI;
    vi.mocked(fetchIntegrationCatalog).mockResolvedValue([
      { id: 'linear', displayName: 'Linear', logoUrl: null, authType: 'OAUTH2', authFields: [], comingSoon: false },
    ]);
    vi.mocked(createProjectConnectSession).mockResolvedValue({
      connectionId: 'conn_new',
      integrationId: 'linear',
      connectUrl: 'https://connect.example/session',
      sessionToken: 'session_tok',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    vi.mocked(fetchOrgMembers).mockResolvedValue([
      { userId: 'user_1', email: 'charlie@mastra.ai', firstName: 'Charlie', lastName: 'Smith' },
    ]);
  });

  afterEach(() => {
    process.stdin.isTTY = originalStdinTTY;
    process.stdout.isTTY = originalStdoutTTY;
    if (originalCI === undefined) delete process.env.CI;
    else process.env.CI = originalCI;
    vi.restoreAllMocks();
    vi.mocked(select).mockReset();
    vi.mocked(text).mockReset();
    vi.mocked(confirm).mockReset();
    vi.mocked(fetchProjectConnections).mockReset();
    vi.mocked(fetchOrgConnections).mockReset();
    vi.mocked(addConnectionToProject).mockReset();
    vi.mocked(createProjectConnectSession).mockReset();
    vi.mocked(updateConnectionDisplayName).mockReset();
  });

  it('attaches an existing org connection when the user picks one', async () => {
    vi.mocked(fetchProjectConnections).mockResolvedValue([]);
    vi.mocked(fetchOrgConnections).mockResolvedValue([connection({ id: 'conn_org', accountLabel: 'charlie' })]);
    vi.mocked(select).mockResolvedValue('conn_org');

    await connectProviderAction('linear');

    expect(addConnectionToProject).toHaveBeenCalledWith('tok', 'org_1', 'proj_1', 'conn_org');
    expect(createProjectConnectSession).not.toHaveBeenCalled();
    expect(output.join('\n')).toContain('(charlie) to My Project');
  });

  it('renders aligned columns with account, connected by, and date', async () => {
    vi.mocked(fetchProjectConnections).mockResolvedValue([]);
    vi.mocked(fetchOrgConnections).mockResolvedValue([
      connection({ id: 'conn_a', accountLabel: 'Mastra', connectedAt: '2026-09-25T12:00:00.000Z' }),
      connection({ id: 'conn_b', accountLabel: 'charlie@mastra.ai', connectedAt: '2026-10-02T12:00:00.000Z' }),
    ]);
    vi.mocked(select).mockResolvedValue('conn_a');

    await connectProviderAction('linear');

    const { options } = vi.mocked(select).mock.calls[0]![0] as { options: { label: string }[] };
    const stripAnsi = (value: string) => value.replace(/\x1b\[[0-9;]*m/g, '');
    const labels = options.map(option => stripAnsi(option.label));
    expect(labels[0]).toBe('Mastra             connected by Charlie Smith  Sep 25, 2026');
    expect(labels[1]).toBe('charlie@mastra.ai  connected by Charlie Smith  Oct 2, 2026');
    expect(labels[2]).toBe('Create a new connection');
    // The date column starts at the same offset in every connection row.
    expect(labels[0]!.indexOf('Sep 25')).toBe(labels[1]!.indexOf('Oct 2'));
  });

  it('goes straight to the create flow when no org connections exist', async () => {
    vi.mocked(fetchProjectConnections)
      .mockResolvedValueOnce([])
      .mockResolvedValue([connection({ id: 'conn_new', accountLabel: 'charlie' })]);
    vi.mocked(fetchOrgConnections).mockResolvedValue([]);

    await connectProviderAction('linear');

    expect(select).not.toHaveBeenCalled();
    expect(addConnectionToProject).not.toHaveBeenCalled();
    expect(createProjectConnectSession).toHaveBeenCalled();
    expect(output.join('\n')).toContain('Connected');
  });

  it('runs the create flow when the user picks "Create a new connection"', async () => {
    vi.mocked(fetchProjectConnections)
      .mockResolvedValueOnce([])
      .mockResolvedValue([connection({ id: 'conn_new' })]);
    vi.mocked(fetchOrgConnections).mockResolvedValue([connection({ id: 'conn_org', accountLabel: 'charlie' })]);
    vi.mocked(select).mockResolvedValue('__create_new__');

    await connectProviderAction('linear');

    expect(addConnectionToProject).not.toHaveBeenCalled();
    expect(createProjectConnectSession).toHaveBeenCalled();
  });

  it('shows the display name first with the account in the detail column, never the id', async () => {
    vi.mocked(fetchProjectConnections).mockResolvedValue([]);
    vi.mocked(fetchOrgConnections).mockResolvedValue([
      connection({
        id: 'conn_a',
        displayName: 'Prod',
        accountLabel: 'Mastra',
        connectedAt: '2026-09-25T12:00:00.000Z',
      }),
      connection({ id: 'conn_b', accountLabel: 'charlie', connectedAt: '2026-10-02T12:00:00.000Z' }),
    ]);
    vi.mocked(select).mockResolvedValue('conn_a');

    await connectProviderAction('linear');

    const { options } = vi.mocked(select).mock.calls[0]![0] as { options: { label: string }[] };
    const stripAnsi = (value: string) => value.replace(/\x1b\[[0-9;]*m/g, '');
    const labels = options.map(option => stripAnsi(option.label));
    expect(labels[0]).toBe('Prod     Mastra  connected by Charlie Smith  Sep 25, 2026');
    expect(labels[1]).toBe('charlie          connected by Charlie Smith  Oct 2, 2026');
    expect(labels.join('\n')).not.toContain('conn_');
  });

  it('saves the display name entered after a new connection goes active', async () => {
    vi.mocked(fetchProjectConnections)
      .mockResolvedValueOnce([])
      .mockResolvedValue([connection({ id: 'conn_new', accountLabel: 'charlie' })]);
    vi.mocked(fetchOrgConnections).mockResolvedValue([]);
    vi.mocked(text).mockResolvedValue('Prod Linear');

    await connectProviderAction('linear');

    expect(updateConnectionDisplayName).toHaveBeenCalledWith('tok', 'org_1', 'conn_new', 'Prod Linear');
    expect(output.join('\n')).toContain('(Prod Linear) to My Project');
  });

  it('suggests a name that does not collide with existing connections', async () => {
    vi.mocked(fetchProjectConnections)
      .mockResolvedValueOnce([])
      .mockResolvedValue([connection({ id: 'conn_new', accountLabel: 'Mastra' })]);
    vi.mocked(fetchOrgConnections).mockResolvedValue([connection({ id: 'conn_org', accountLabel: 'Mastra' })]);
    vi.mocked(select).mockResolvedValue('__create_new__');
    vi.mocked(text).mockResolvedValue(undefined as never);

    await connectProviderAction('linear');

    const textCall = vi.mocked(text).mock.calls[0]![0] as { initialValue?: string };
    expect(textCall.initialValue).toBe('Mastra 2');
    // Existing connections are listed so the user can see what's taken.
    expect(output.join('\n')).toContain("Your organization's existing Linear connections:");
    expect(updateConnectionDisplayName).not.toHaveBeenCalled();
  });

  it('warns and confirms before using a name that collides', async () => {
    vi.mocked(fetchProjectConnections)
      .mockResolvedValueOnce([])
      .mockResolvedValue([connection({ id: 'conn_new', accountLabel: 'charlie' })]);
    vi.mocked(fetchOrgConnections).mockResolvedValue([
      connection({ id: 'conn_org', displayName: 'Prod', accountLabel: 'Mastra' }),
    ]);
    vi.mocked(select).mockResolvedValue('__create_new__');
    vi.mocked(text).mockResolvedValue('prod');
    vi.mocked(confirm).mockResolvedValue(true);

    await connectProviderAction('linear');

    const confirmCall = vi.mocked(confirm).mock.calls[0]![0] as { message: string };
    expect(confirmCall.message).toContain('already named "Prod"');
    expect(updateConnectionDisplayName).toHaveBeenCalledWith('tok', 'org_1', 'conn_new', 'prod');
  });

  it('re-prompts when the user declines a colliding name', async () => {
    vi.mocked(fetchProjectConnections)
      .mockResolvedValueOnce([])
      .mockResolvedValue([connection({ id: 'conn_new', accountLabel: 'charlie' })]);
    vi.mocked(fetchOrgConnections).mockResolvedValue([
      connection({ id: 'conn_org', displayName: 'Prod', accountLabel: 'Mastra' }),
    ]);
    vi.mocked(select).mockResolvedValue('__create_new__');
    vi.mocked(text).mockResolvedValueOnce('Prod').mockResolvedValueOnce('Prod 2');
    vi.mocked(confirm).mockResolvedValue(false);

    await connectProviderAction('linear');

    expect(text).toHaveBeenCalledTimes(2);
    expect(updateConnectionDisplayName).toHaveBeenCalledWith('tok', 'org_1', 'conn_new', 'Prod 2');
  });

  it('skips the reuse prompt entirely with --yes', async () => {
    vi.mocked(fetchProjectConnections)
      .mockResolvedValueOnce([])
      .mockResolvedValue([connection({ id: 'conn_new' })]);
    vi.mocked(fetchOrgConnections).mockResolvedValue([connection({ id: 'conn_org' })]);

    await connectProviderAction('linear', { yes: true });

    expect(fetchOrgConnections).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(createProjectConnectSession).toHaveBeenCalled();
  });
});
