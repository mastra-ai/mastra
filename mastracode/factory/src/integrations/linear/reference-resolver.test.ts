import { describe, expect, it, vi } from 'vitest';

import { createLinearReferenceResolver, extractLinearIssueIdentifiers } from './reference-resolver.js';

describe('extractLinearIssueIdentifiers', () => {
  it('finds bare keys and issue urls, deduplicated and uppercased', () => {
    expect(
      extractLinearIssueIdentifiers(
        'PROD-35 again: https://linear.app/acme/issue/prod-35/broken-thing and ENG-7, plus <https://linear.app/acme/issue/OPS-1|OPS-1>',
      ),
    ).toEqual(['PROD-35', 'OPS-1', 'ENG-7']);
  });

  it('ignores lowercase and embedded lookalikes', () => {
    expect(extractLinearIssueIdentifiers('prod-35 v1-2 abc/DEF-1 GPT-4o X-1-2')).toEqual([]);
  });

  it('caps the number of references', () => {
    const text = Array.from({ length: 8 }, (_, i) => `ENG-${i + 1}`).join(' ');
    expect(extractLinearIssueIdentifiers(text)).toHaveLength(5);
  });
});

describe('createLinearReferenceResolver', () => {
  const connection = { id: 'conn-1', orgId: 'org-1' } as any;
  const issues: Record<string, { identifier: string; projectId: string | null; teamId: string | null }> = {
    'PROD-35': { identifier: 'PROD-35', projectId: 'proj-web', teamId: 'team-prod' },
    'ENG-7': { identifier: 'ENG-7', projectId: null, teamId: 'team-eng' },
  };

  function makeLinear() {
    return {
      loadConnection: vi.fn().mockResolvedValue(connection),
      getFreshAccessToken: vi.fn().mockResolvedValue('token'),
      fetchIssueDetail: vi.fn(async (_token: string, id: string) => issues[id] ?? null),
      sourceMatchesIssue: (sourceId: string, issue: { projectId: string | null; teamId: string | null }) =>
        sourceId.startsWith('linear-team:')
          ? issue.teamId === sourceId.slice('linear-team:'.length)
          : issue.projectId === sourceId,
    };
  }

  function makeIntake(bindings: Array<{ sourceId: string; factoryProjectId: string }>) {
    return {
      listBindings: vi
        .fn()
        .mockResolvedValue(bindings.map(binding => ({ integrationId: 'linear', board: null, ...binding }))),
    };
  }

  it('maps an issue to the factory bound to its project, preferring project over team bindings', async () => {
    const linear = makeLinear();
    const intake = makeIntake([
      { sourceId: 'linear-team:team-prod', factoryProjectId: 'fp-team' },
      { sourceId: 'proj-web', factoryProjectId: 'fp-web' },
    ]);
    const resolve = createLinearReferenceResolver({ linear, intake });

    await expect(resolve({ orgId: 'org-1', text: 'fix PROD-35' })).resolves.toEqual([
      { reference: 'PROD-35', factoryProjectId: 'fp-web' },
    ]);
    expect(intake.listBindings).toHaveBeenCalledWith({ orgId: 'org-1', integrationId: 'linear' });
    expect(linear.fetchIssueDetail).toHaveBeenCalledWith('token', 'PROD-35');
  });

  it('falls back to a team binding for an issue without a project', async () => {
    const resolve = createLinearReferenceResolver({
      linear: makeLinear(),
      intake: makeIntake([{ sourceId: 'linear-team:team-eng', factoryProjectId: 'fp-eng' }]),
    });
    await expect(resolve({ orgId: 'org-1', text: 'ENG-7' })).resolves.toEqual([
      { reference: 'ENG-7', factoryProjectId: 'fp-eng' },
    ]);
  });

  it('skips unknown issues and issues nothing is bound to', async () => {
    const linear = makeLinear();
    const resolve = createLinearReferenceResolver({
      linear,
      intake: makeIntake([{ sourceId: 'proj-web', factoryProjectId: 'fp-web' }]),
    });
    await expect(resolve({ orgId: 'org-1', text: 'ENG-7 NOPE-1' })).resolves.toEqual([]);
  });

  it('does not touch Linear when the text has no references or the org has no bindings', async () => {
    const linear = makeLinear();
    const empty = createLinearReferenceResolver({ linear, intake: makeIntake([]) });
    await expect(empty({ orgId: 'org-1', text: 'PROD-35' })).resolves.toEqual([]);
    const bound = createLinearReferenceResolver({
      linear,
      intake: makeIntake([{ sourceId: 'proj-web', factoryProjectId: 'fp-web' }]),
    });
    await expect(bound({ orgId: 'org-1', text: 'nothing here' })).resolves.toEqual([]);
    expect(linear.loadConnection).not.toHaveBeenCalled();
  });

  it('returns nothing for an org without a Linear connection', async () => {
    const linear = makeLinear();
    linear.loadConnection.mockResolvedValue(null);
    const resolve = createLinearReferenceResolver({
      linear,
      intake: makeIntake([{ sourceId: 'proj-web', factoryProjectId: 'fp-web' }]),
    });
    await expect(resolve({ orgId: 'org-1', text: 'PROD-35' })).resolves.toEqual([]);
    expect(linear.fetchIssueDetail).not.toHaveBeenCalled();
  });
});
