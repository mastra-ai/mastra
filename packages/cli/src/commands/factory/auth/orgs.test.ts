import { beforeEach, describe, expect, test, vi } from 'vitest';

const fetchOrgsMock = vi.fn();
const getCurrentOrgIdMock = vi.fn();
const setCurrentOrgIdMock = vi.fn();
const selectMock = vi.fn();

vi.mock('./api.js', () => ({ fetchOrgs: fetchOrgsMock }));
vi.mock('./credentials.js', () => ({
  getToken: vi.fn(),
  getCurrentOrgId: getCurrentOrgIdMock,
  setCurrentOrgId: setCurrentOrgIdMock,
}));
vi.mock('@clack/prompts', () => ({
  select: selectMock,
  isCancel: (v: unknown) => v === Symbol.for('clack:cancel'),
  cancel: vi.fn(),
}));

const { OrgSelectionCancelledError, resolveCurrentOrg } = await import('./orgs.js');

const ORG_A = { id: 'org_a', name: 'Org A' };
const ORG_B = { id: 'org_b', name: 'Org B' };

describe('resolveCurrentOrg', () => {
  beforeEach(() => {
    fetchOrgsMock.mockReset();
    getCurrentOrgIdMock.mockReset();
    setCurrentOrgIdMock.mockReset();
    selectMock.mockReset();
    delete process.env.MASTRA_ORG_ID;
    delete process.env.CI;
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  });

  test('auto-selects when user belongs to a single org', async () => {
    fetchOrgsMock.mockResolvedValue([ORG_A]);
    getCurrentOrgIdMock.mockResolvedValue(null);

    const result = await resolveCurrentOrg('tok');

    expect(result).toEqual({ orgId: 'org_a', orgName: 'Org A' });
    expect(selectMock).not.toHaveBeenCalled();
  });

  test('returns persisted current org without prompting (default)', async () => {
    fetchOrgsMock.mockResolvedValue([ORG_A, ORG_B]);
    getCurrentOrgIdMock.mockResolvedValue('org_b');

    const result = await resolveCurrentOrg('tok');

    expect(result).toEqual({ orgId: 'org_b', orgName: 'Org B' });
    expect(selectMock).not.toHaveBeenCalled();
  });

  test('forcePrompt shows picker even when a current org is persisted', async () => {
    fetchOrgsMock.mockResolvedValue([ORG_A, ORG_B]);
    getCurrentOrgIdMock.mockResolvedValue('org_b');
    selectMock.mockResolvedValue('org_a');

    const result = await resolveCurrentOrg('tok', { forcePrompt: true });

    expect(selectMock).toHaveBeenCalledTimes(1);
    const args = selectMock.mock.calls[0]![0];
    expect(args.message).toMatch(/select an organization/i);
    expect(args.initialValue).toBe('org_b');
    expect(args.options.map((o: { value: string }) => o.value)).toEqual(['org_a', 'org_b']);
    expect(result).toEqual({ orgId: 'org_a', orgName: 'Org A' });
  });

  test('forcePrompt persists the new selection back to credentials', async () => {
    fetchOrgsMock.mockResolvedValue([ORG_A, ORG_B]);
    getCurrentOrgIdMock.mockResolvedValue('org_b');
    selectMock.mockResolvedValue('org_a');

    await resolveCurrentOrg('tok', { forcePrompt: true });

    expect(setCurrentOrgIdMock).toHaveBeenCalledWith('org_a');
  });

  test('forcePrompt does not re-persist when user keeps the current org', async () => {
    fetchOrgsMock.mockResolvedValue([ORG_A, ORG_B]);
    getCurrentOrgIdMock.mockResolvedValue('org_b');
    selectMock.mockResolvedValue('org_b');

    await resolveCurrentOrg('tok', { forcePrompt: true });

    expect(setCurrentOrgIdMock).not.toHaveBeenCalled();
  });

  test('forcePrompt reuses the current org without prompting when non-interactive', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    fetchOrgsMock.mockResolvedValue([ORG_A, ORG_B]);
    getCurrentOrgIdMock.mockResolvedValue('org_b');

    const result = await resolveCurrentOrg('tok', { forcePrompt: true });

    expect(result).toEqual({ orgId: 'org_b', orgName: 'Org B' });
    expect(selectMock).not.toHaveBeenCalled();
  });

  test('forcePrompt throws a setup error instead of prompting when non-interactive and no current org exists', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    fetchOrgsMock.mockResolvedValue([ORG_A, ORG_B]);
    getCurrentOrgIdMock.mockResolvedValue(null);

    await expect(resolveCurrentOrg('tok', { forcePrompt: true })).rejects.toThrow(/set MASTRA_ORG_ID/i);
    expect(selectMock).not.toHaveBeenCalled();
  });

  test('MASTRA_ORG_ID overrides forcePrompt and skips picker', async () => {
    process.env.MASTRA_ORG_ID = 'org_a';
    fetchOrgsMock.mockResolvedValue([ORG_A, ORG_B]);
    getCurrentOrgIdMock.mockResolvedValue('org_b');

    const result = await resolveCurrentOrg('tok', { forcePrompt: true });

    expect(result).toEqual({ orgId: 'org_a', orgName: 'Org A' });
    expect(selectMock).not.toHaveBeenCalled();
  });

  test('prompts when multiple orgs and no current org is persisted', async () => {
    fetchOrgsMock.mockResolvedValue([ORG_A, ORG_B]);
    getCurrentOrgIdMock.mockResolvedValue(null);
    selectMock.mockResolvedValue('org_b');

    const result = await resolveCurrentOrg('tok');

    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ orgId: 'org_b', orgName: 'Org B' });
    expect(setCurrentOrgIdMock).toHaveBeenCalledWith('org_b');
  });

  test('throws instead of exiting when cancellation is owned by the caller', async () => {
    const controller = new AbortController();
    fetchOrgsMock.mockResolvedValue([ORG_A, ORG_B]);
    getCurrentOrgIdMock.mockResolvedValue('org_a');
    selectMock.mockResolvedValue(Symbol.for('clack:cancel'));

    await expect(
      resolveCurrentOrg('tok', { forcePrompt: true, exitOnCancel: false, signal: controller.signal }),
    ).rejects.toBeInstanceOf(OrgSelectionCancelledError);
    expect(selectMock).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
  });

  test('throws when no orgs exist', async () => {
    fetchOrgsMock.mockResolvedValue([]);
    getCurrentOrgIdMock.mockResolvedValue(null);

    await expect(resolveCurrentOrg('tok')).rejects.toThrow(/no organizations/i);
  });
});
