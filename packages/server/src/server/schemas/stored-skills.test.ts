import { describe, expect, it } from 'vitest';

import { SKILL_ORIGIN_METADATA_KEY, buildOriginMetadata, readSkillOrigin, skillOriginSchema } from './stored-skills';
import type { SkillOrigin } from './stored-skills';

describe('skillOriginSchema', () => {
  it('accepts a skills-sh origin', () => {
    const origin: SkillOrigin = {
      type: 'skills-sh',
      owner: 'mastra-ai',
      repo: 'mastra',
      skillName: 'foo',
      installedAt: '2026-05-07T12:00:00Z',
    };
    expect(skillOriginSchema.parse(origin)).toEqual(origin);
  });

  it('rejects unknown types', () => {
    const result = skillOriginSchema.safeParse({
      type: 'github',
      owner: 'a',
      repo: 'b',
      skillName: 'c',
      installedAt: 'now',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = skillOriginSchema.safeParse({
      type: 'skills-sh',
      owner: 'a',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a library-copy origin with optional sourceAuthorId', () => {
    const origin: SkillOrigin = {
      type: 'library-copy',
      sourceSkillId: 'public-skill-1',
      sourceSkillName: 'Public Skill',
      sourceAuthorId: 'user-42',
      copiedAt: '2026-05-08T18:00:00Z',
    };
    expect(skillOriginSchema.parse(origin)).toEqual(origin);
  });

  it('accepts a library-copy origin without sourceAuthorId', () => {
    const origin: SkillOrigin = {
      type: 'library-copy',
      sourceSkillId: 'public-skill-1',
      sourceSkillName: 'Public Skill',
      copiedAt: '2026-05-08T18:00:00Z',
    };
    expect(skillOriginSchema.parse(origin)).toEqual(origin);
  });

  it('rejects library-copy with missing required fields', () => {
    const result = skillOriginSchema.safeParse({
      type: 'library-copy',
      sourceSkillId: 'public-skill-1',
    });
    expect(result.success).toBe(false);
  });
});

describe('readSkillOrigin', () => {
  const validOrigin: SkillOrigin = {
    type: 'skills-sh',
    owner: 'mastra-ai',
    repo: 'mastra',
    skillName: 'foo',
    installedAt: '2026-05-07T12:00:00Z',
  };

  it('returns null when metadata is undefined', () => {
    expect(readSkillOrigin(undefined)).toBeNull();
  });

  it('returns null when metadata is empty', () => {
    expect(readSkillOrigin({})).toBeNull();
  });

  it('returns null when origin key is absent', () => {
    expect(readSkillOrigin({ tags: ['foo'] })).toBeNull();
  });

  it('returns null when origin is malformed', () => {
    expect(readSkillOrigin({ origin: { type: 'github', owner: 'a' } })).toBeNull();
  });

  it('returns the typed origin when valid', () => {
    expect(readSkillOrigin({ origin: validOrigin })).toEqual(validOrigin);
  });
});

describe('buildOriginMetadata', () => {
  it('writes under the documented metadata key', () => {
    const origin: SkillOrigin = {
      type: 'skills-sh',
      owner: 'a',
      repo: 'b',
      skillName: 'c',
      installedAt: '2026-05-07T12:00:00Z',
    };
    expect(buildOriginMetadata(origin)).toEqual({ [SKILL_ORIGIN_METADATA_KEY]: origin });
    expect(SKILL_ORIGIN_METADATA_KEY).toBe('origin');
  });

  it('round-trips through readSkillOrigin', () => {
    const origin: SkillOrigin = {
      type: 'skills-sh',
      owner: 'a',
      repo: 'b',
      skillName: 'c',
      installedAt: '2026-05-07T12:00:00Z',
    };
    expect(readSkillOrigin(buildOriginMetadata(origin))).toEqual(origin);
  });
});
