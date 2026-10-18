import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';

const KEY = { orgId: 'org-1', factoryProjectId: 'fp-1', boardId: 'work', phaseId: 'triaging' };

describe('PhaseSkillsStorage', () => {
  it('returns null when a phase has no skill', async () => {
    const seed = await createFactoryStorageForTests();
    expect(await seed.phaseSkills.get(KEY)).toBeNull();
  });

  it('sets, replaces, lists, and clears a phase skill', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.phaseSkills.set({ ...KEY, skillName: 'factory-triage', prompt: null });
    await seed.phaseSkills.set({ ...KEY, skillName: 'my-triage', prompt: null });
    await seed.phaseSkills.set({ ...KEY, phaseId: 'planning', skillName: null, prompt: 'Plan it.' });

    expect(await seed.phaseSkills.get(KEY)).toMatchObject({ skillName: 'my-triage', prompt: null });
    const listed = await seed.phaseSkills.list({ orgId: 'org-1', factoryProjectId: 'fp-1' });
    expect(listed.map(r => [r.phaseId, r.skillName]).sort()).toEqual([
      ['planning', null],
      ['triaging', 'my-triage'],
    ]);

    expect(await seed.phaseSkills.get({ ...KEY, phaseId: 'planning' })).toMatchObject({
      skillName: null,
      prompt: 'Plan it.',
    });

    await seed.phaseSkills.clear(KEY);
    expect(await seed.phaseSkills.get(KEY)).toBeNull();
  });

  it('isolates skills by organization and factory', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.phaseSkills.set({ ...KEY, skillName: 'my-triage', prompt: null });

    expect(await seed.phaseSkills.get({ ...KEY, orgId: 'org-2' })).toBeNull();
    expect(await seed.phaseSkills.get({ ...KEY, factoryProjectId: 'fp-2' })).toBeNull();
  });

  it('sends every phase running a skill back to its default', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.phaseSkills.set({ ...KEY, skillName: 'my-triage', prompt: null });
    await seed.phaseSkills.set({ ...KEY, phaseId: 'planning', skillName: 'my-triage', prompt: null });
    await seed.phaseSkills.set({ ...KEY, phaseId: 'review', skillName: null, prompt: 'Review.' });

    expect(
      await seed.phaseSkills.clearSkill({ orgId: 'org-1', factoryProjectId: 'fp-1', skillName: 'my-triage' }),
    ).toBe(2);
    const listed = await seed.phaseSkills.list({ orgId: 'org-1', factoryProjectId: 'fp-1' });
    expect(listed.map(r => r.phaseId)).toEqual(['review']);
  });
});
