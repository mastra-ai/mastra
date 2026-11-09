import type { MastraStorage, SkillsStorage, StorageCreateSkillInput } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

const createSkill = (id: string): StorageCreateSkillInput => ({
  id,
  authorId: 'owner',
  visibility: 'public',
  name: 'Stable Snapshot',
  description: 'Original description',
  instructions: 'Original instructions',
  metadata: {
    alpha: { enabled: true, count: 1 },
    beta: ['one', 'two'],
  },
  tree: {
    entries: {
      'SKILL.md': { blobHash: 'hash-1', size: 100, mimeType: 'text/markdown' },
      'scripts/setup.sh': { blobHash: 'hash-2', size: 50 },
    },
  },
});

export function createSkillsTests({
  storage,
  metadataFilter = true,
}: {
  storage: MastraStorage;
  metadataFilter?: boolean;
}) {
  const itMetadata = metadataFilter ? it : it.skip;
  const describeSkills = storage.stores?.skills ? describe : describe.skip;
  let skillsStorage: SkillsStorage;

  describeSkills('Skills Storage', () => {
    beforeAll(async () => {
      const skills = await storage.getStore('skills');
      if (!skills) throw new Error('Skills storage not found');
      skillsStorage = skills;
    });

    beforeEach(async () => {
      await skillsStorage.dangerouslyClearAll();
    });

    it('persists visibility on create, update, and list', async () => {
      const publicSkill = createSkill(`skill-public-${Date.now()}`);
      const created = await skillsStorage.create({ skill: publicSkill });
      expect(created.visibility).toBe('public');
      expect((await skillsStorage.getById(publicSkill.id))?.visibility).toBe('public');

      const { visibility: _visibility, ...privateInput } = createSkill(`skill-private-${Date.now()}`);
      await skillsStorage.create({ skill: privateInput });
      expect((await skillsStorage.getById(privateInput.id))?.visibility).toBe('private');

      const publicList = await skillsStorage.list({ visibility: 'public' });
      expect(publicList.skills.map(s => s.id)).toEqual([publicSkill.id]);

      await skillsStorage.update({ id: privateInput.id, visibility: 'public' });
      expect((await skillsStorage.getById(privateInput.id))?.visibility).toBe('public');
      expect(await skillsStorage.countVersions(privateInput.id)).toBe(1);

      const updatedList = await skillsStorage.list({ visibility: 'public' });
      expect(updatedList.skills.map(s => s.id).sort()).toEqual([privateInput.id, publicSkill.id].sort());
    });

    it('list filters by status and entityIds, with filtered totals', async () => {
      const draft = createSkill(`skill-draft-${Date.now()}`);
      const published = createSkill(`skill-pub-${Date.now()}`);
      await skillsStorage.create({ skill: draft });
      await skillsStorage.create({ skill: published });
      const latest = await skillsStorage.getLatestVersion(published.id);
      await skillsStorage.update({ id: published.id, activeVersionId: latest!.id, status: 'published' });

      const byStatus = await skillsStorage.list({ status: 'published' });
      expect(byStatus.skills.map(s => s.id)).toEqual([published.id]);
      expect(byStatus.total).toBe(1);

      const empty = await skillsStorage.list({ entityIds: [] });
      expect(empty.skills).toEqual([]);
      expect(empty.total).toBe(0);

      const byIds = await skillsStorage.list({ entityIds: [draft.id] });
      expect(byIds.skills.map(s => s.id)).toEqual([draft.id]);
      expect(byIds.total).toBe(1);

      const combined = await skillsStorage.list({ entityIds: [draft.id], status: 'published' });
      expect(combined.skills).toEqual([]);
      expect(combined.total).toBe(0);
    });

    it('round-trips files on create, update, and resolve', async () => {
      const files = [
        {
          name: 'scripts',
          type: 'folder' as const,
          children: [{ name: 'setup.sh', type: 'file' as const, content: 'echo hi' }],
        },
      ];
      const skill = { ...createSkill(`skill-files-${Date.now()}`), files };
      await skillsStorage.create({ skill });

      expect((await skillsStorage.getLatestVersion(skill.id))?.files).toEqual(files);
      expect((await skillsStorage.getByIdResolved(skill.id))?.files).toEqual(files);

      const updatedFiles = [{ name: 'README.md', type: 'file' as const, content: '# hi' }];
      await skillsStorage.update({ id: skill.id, files: updatedFiles });

      expect(await skillsStorage.countVersions(skill.id)).toBe(2);
      const latest = await skillsStorage.getLatestVersion(skill.id);
      expect(latest?.files).toEqual(updatedFiles);
      expect(latest?.changedFields).toContain('files');
    });

    it('does not create duplicate versions for semantically unchanged snapshots', async () => {
      const skill = createSkill(`skill-${Date.now()}`);
      await skillsStorage.create({ skill });

      await skillsStorage.update({
        id: skill.id,
        license: undefined,
        metadata: {
          beta: ['one', 'two'],
          alpha: { count: 1, enabled: true },
        },
        tree: {
          entries: {
            'scripts/setup.sh': { size: 50, blobHash: 'hash-2' },
            'SKILL.md': { mimeType: 'text/markdown', size: 100, blobHash: 'hash-1' },
          },
        },
      });

      expect(await skillsStorage.countVersions(skill.id)).toBe(1);
    });

    it('getVersions returns all requested versions and omits missing ids', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const skill = createSkill(`skill-batch-${i}-${Date.now()}`);
        await skillsStorage.create({ skill });
        const latest = await skillsStorage.getLatestVersion(skill.id);
        ids.push(latest!.id);
      }

      const versions = await skillsStorage.getVersions([...ids, 'missing-version-id']);
      expect(versions.map(v => v.id).sort()).toEqual([...ids].sort());
      expect(await skillsStorage.getVersions([])).toEqual([]);
    });

    it('listResolved resolves published skills with their active version in one batch', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const skill = createSkill(`skill-published-${i}-${Date.now()}`);
        await skillsStorage.create({ skill });
        const latest = await skillsStorage.getLatestVersion(skill.id);
        await skillsStorage.update({ id: skill.id, activeVersionId: latest!.id, status: 'published' });
        ids.push(skill.id);
      }

      const result = await skillsStorage.listResolved({ perPage: false, status: 'published' });
      expect(result.skills).toHaveLength(5);
      for (const skill of result.skills) {
        expect(ids).toContain(skill.id);
        expect(skill.resolvedVersionId).toBe(skill.activeVersionId);
        expect(skill.instructions).toBe('Original instructions');
      }
    });

    itMetadata('list and listResolved filter by version metadata with filtered totals and pagination', async () => {
      const suffix = Date.now();
      const withMetadata = (id: string, metadata: Record<string, unknown>) => ({ ...createSkill(id), metadata });
      const a = withMetadata(`skill-meta-a-${suffix}`, { publishedBy: 'user-123', tier: 'pro' });
      const b = withMetadata(`skill-meta-b-${suffix}`, { publishedBy: 'user-123', tier: 'free' });
      const c = withMetadata(`skill-meta-c-${suffix}`, { publishedBy: 'user-456', tier: 'pro' });
      for (const skill of [a, b, c]) {
        await skillsStorage.create({ skill });
      }

      const byPublisher = await skillsStorage.list({ metadata: { publishedBy: 'user-123' } });
      expect(byPublisher.skills.map(s => s.id).sort()).toEqual([a.id, b.id].sort());
      expect(byPublisher.total).toBe(2);

      const multiKey = await skillsStorage.list({ metadata: { publishedBy: 'user-123', tier: 'pro' } });
      expect(multiKey.skills.map(s => s.id)).toEqual([a.id]);
      expect(multiKey.total).toBe(1);

      const none = await skillsStorage.list({ metadata: { publishedBy: 'nobody' } });
      expect(none.skills).toEqual([]);
      expect(none.total).toBe(0);

      const firstPage = await skillsStorage.list({ metadata: { publishedBy: 'user-123' }, perPage: 1, page: 0 });
      expect(firstPage.skills).toHaveLength(1);
      expect(firstPage.total).toBe(2);
      expect(firstPage.hasMore).toBe(true);
      const secondPage = await skillsStorage.list({ metadata: { publishedBy: 'user-123' }, perPage: 1, page: 1 });
      expect(secondPage.skills).toHaveLength(1);
      expect(secondPage.hasMore).toBe(false);
      expect([firstPage.skills[0]!.id, secondPage.skills[0]!.id].sort()).toEqual([a.id, b.id].sort());

      const resolved = await skillsStorage.listResolved({ metadata: { tier: 'pro' } });
      expect(resolved.skills.map(s => s.id).sort()).toEqual([a.id, c.id].sort());
      for (const skill of resolved.skills) {
        expect(skill.metadata?.tier).toBe('pro');
      }
    });

    itMetadata('metadata filter matches boolean, numeric and nested values', async () => {
      const suffix = Date.now();
      const on = {
        ...createSkill(`skill-meta-typed-on-${suffix}`),
        metadata: { featured: true, rank: 2, owner: { team: 'core', tag: suffix } },
      };
      const off = {
        ...createSkill(`skill-meta-typed-off-${suffix}`),
        metadata: { featured: false, rank: 3, owner: { team: 'docs', tag: suffix } },
      };
      await skillsStorage.create({ skill: on });
      await skillsStorage.create({ skill: off });
      const ids = [on.id, off.id];
      const idsFor = async (metadata: Record<string, unknown>) =>
        (await skillsStorage.list({ metadata, perPage: false })).skills.map(s => s.id).filter(id => ids.includes(id));

      expect(await idsFor({ featured: true })).toEqual([on.id]);
      expect(await idsFor({ featured: false })).toEqual([off.id]);
      expect(await idsFor({ rank: 3 })).toEqual([off.id]);
      expect(await idsFor({ owner: { team: 'core', tag: suffix } })).toEqual([on.id]);
      expect(await idsFor({ featured: true, rank: 3 })).toEqual([]);
    });

    itMetadata(
      'metadata filter matches the active version for published and the latest version for drafts',
      async () => {
        const skill = { ...createSkill(`skill-meta-versions-${Date.now()}`), metadata: { stage: 'v1' } };
        await skillsStorage.create({ skill });
        const v1 = await skillsStorage.getLatestVersion(skill.id);
        await skillsStorage.update({ id: skill.id, activeVersionId: v1!.id, status: 'published' });
        await skillsStorage.update({ id: skill.id, metadata: { stage: 'v2' } });
        expect(await skillsStorage.countVersions(skill.id)).toBe(2);

        expect((await skillsStorage.list({ metadata: { stage: 'v1' } })).total).toBe(1);
        expect((await skillsStorage.list({ metadata: { stage: 'v2' } })).total).toBe(0);

        await skillsStorage.update({ id: skill.id, status: 'draft' });
        const drafts = await skillsStorage.listResolved({ status: 'draft', metadata: { stage: 'v2' } });
        expect(drafts.skills.map(s => s.id)).toEqual([skill.id]);
      },
    );
  });
}
