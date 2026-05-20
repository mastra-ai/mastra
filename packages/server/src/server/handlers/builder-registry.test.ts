import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BUILDER_REGISTRY_INSTALL_ROUTE,
  BUILDER_REGISTRY_POPULAR_ROUTE,
  BUILDER_REGISTRY_PREVIEW_ROUTE,
  BUILDER_REGISTRY_SEARCH_ROUTE,
  LIST_BUILDER_REGISTRIES_ROUTE,
} from './builder-registry';

// =============================================================================
// Helpers
// =============================================================================

interface BuildMastraOpts {
  registryEnabled?: boolean;
  noEditor?: boolean;
  noBuilder?: boolean;
  storage?: any;
}

const buildMastra = ({
  registryEnabled = true,
  noEditor = false,
  noBuilder = false,
  storage,
}: BuildMastraOpts = {}) => {
  if (noEditor) {
    return { getEditor: () => undefined } as any;
  }
  const builder = noBuilder
    ? undefined
    : {
        getRegistries: () => ({ skillsSh: { enabled: registryEnabled } }),
      };
  return {
    getEditor: () => ({
      resolveBuilder: vi.fn().mockResolvedValue(builder),
    }),
    getStorage: () => storage,
  } as any;
};

const ctx = (overrides: Record<string, unknown> = {}) =>
  ({
    requestContext: {
      get: () => undefined,
    },
    ...overrides,
  }) as any;

// =============================================================================
// Tests
// =============================================================================

describe('GET /editor/builder/registries', () => {
  it('reports skills-sh disabled when no editor configured', async () => {
    const mastra = buildMastra({ noEditor: true });
    const result = (await LIST_BUILDER_REGISTRIES_ROUTE.handler({ mastra, ...ctx() })) as any;
    expect(result.registries).toEqual([{ id: 'skills-sh', enabled: false, label: 'skills.sh' }]);
  });

  it('reports skills-sh disabled when builder lacks registries config', async () => {
    const mastra = buildMastra({ noBuilder: true });
    const result = (await LIST_BUILDER_REGISTRIES_ROUTE.handler({ mastra, ...ctx() })) as any;
    expect(result.registries).toEqual([{ id: 'skills-sh', enabled: false, label: 'skills.sh' }]);
  });

  it('reports skills-sh enabled when builder config sets it', async () => {
    const mastra = buildMastra({ registryEnabled: true });
    const result = (await LIST_BUILDER_REGISTRIES_ROUTE.handler({ mastra, ...ctx() })) as any;
    expect(result.registries).toEqual([{ id: 'skills-sh', enabled: true, label: 'skills.sh' }]);
  });
});

describe('GET /editor/builder/registries/:registryId/search', () => {
  const mockFetch = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', mockFetch));
  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllGlobals();
  });

  it('404s when registry is disabled', async () => {
    const mastra = buildMastra({ registryEnabled: false });
    await expect(
      BUILDER_REGISTRY_SEARCH_ROUTE.handler({ mastra, ...ctx({ registryId: 'skills-sh', q: 'foo', limit: 10 }) }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('404s when registryId is unknown', async () => {
    const mastra = buildMastra();
    await expect(
      BUILDER_REGISTRY_SEARCH_ROUTE.handler({ mastra, ...ctx({ registryId: 'unknown', q: 'foo', limit: 10 }) }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('proxies to upstream when registry is enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ skills: [], total: 0 }),
    });
    const mastra = buildMastra();
    const result = (await BUILDER_REGISTRY_SEARCH_ROUTE.handler({
      mastra,
      ...ctx({ registryId: 'skills-sh', q: 'foo', limit: 10 }),
    })) as any;
    expect(result).toEqual({ query: 'foo', searchType: 'query', skills: [], count: 0 });
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

describe('GET /editor/builder/registries/:registryId/popular', () => {
  const mockFetch = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', mockFetch));
  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllGlobals();
  });

  it('404s when registry is disabled', async () => {
    const mastra = buildMastra({ registryEnabled: false });
    await expect(
      BUILDER_REGISTRY_POPULAR_ROUTE.handler({ mastra, ...ctx({ registryId: 'skills-sh', limit: 10, offset: 0 }) }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('proxies to upstream when registry is enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ skills: [], total: 0 }),
    });
    const mastra = buildMastra();
    const result = (await BUILDER_REGISTRY_POPULAR_ROUTE.handler({
      mastra,
      ...ctx({ registryId: 'skills-sh', limit: 10, offset: 0 }),
    })) as any;
    expect(result).toEqual({ skills: [], count: 0, limit: 10, offset: 0 });
  });
});

describe('GET /editor/builder/registries/:registryId/preview', () => {
  const mockFetch = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', mockFetch));
  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllGlobals();
  });

  it('404s when registry is disabled', async () => {
    const mastra = buildMastra({ registryEnabled: false });
    await expect(
      BUILDER_REGISTRY_PREVIEW_ROUTE.handler({
        mastra,
        ...ctx({ registryId: 'skills-sh', owner: 'a', repo: 'b', path: 'c' }),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns content when registry is enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ instructions: '# hello' }),
    });
    const mastra = buildMastra();
    const result = (await BUILDER_REGISTRY_PREVIEW_ROUTE.handler({
      mastra,
      ...ctx({ registryId: 'skills-sh', owner: 'a', repo: 'b', path: 'c' }),
    })) as any;
    expect(result.content).toBe('# hello');
  });
});

describe('POST /editor/builder/registries/:registryId/install', () => {
  const mockFetch = vi.fn();

  const buildSkillStore = () => {
    const skills = new Map<string, any>();
    return {
      _skills: skills,
      getById: vi.fn(async (id: string) => skills.get(id) ?? null),
      create: vi.fn(async ({ skill }: { skill: any }) => {
        skills.set(skill.id, skill);
        return skill;
      }),
    };
  };

  const buildStorage = (skillStore: ReturnType<typeof buildSkillStore>) => ({
    getStore: vi.fn(async (domain: string) => (domain === 'skills' ? skillStore : null)),
  });

  beforeEach(() => vi.stubGlobal('fetch', mockFetch));
  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllGlobals();
  });

  it('404s when registry is disabled', async () => {
    const mastra = buildMastra({ registryEnabled: false });
    await expect(
      BUILDER_REGISTRY_INSTALL_ROUTE.handler({
        mastra,
        ...ctx({ registryId: 'skills-sh', owner: 'a', repo: 'b', skillName: 'demo' }),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('500s when storage is missing', async () => {
    const mastra = buildMastra({ storage: undefined });
    await expect(
      BUILDER_REGISTRY_INSTALL_ROUTE.handler({
        mastra,
        ...ctx({ registryId: 'skills-sh', owner: 'a', repo: 'b', skillName: 'demo' }),
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('404s when upstream has no files', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });
    const skillStore = buildSkillStore();
    const mastra = buildMastra({ storage: buildStorage(skillStore) });
    await expect(
      BUILDER_REGISTRY_INSTALL_ROUTE.handler({
        mastra,
        ...ctx({ registryId: 'skills-sh', owner: 'a', repo: 'b', skillName: 'missing' }),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('persists a stored skill with origin metadata + parsed frontmatter', async () => {
    const skillMd = `---
name: My Demo
description: Demo skill imported from skills.sh
---

Body content.`;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        skillId: 'demo-skill',
        owner: 'a',
        repo: 'b',
        branch: 'main',
        files: [
          { path: 'SKILL.md', content: skillMd, encoding: 'utf-8' },
          { path: 'references/notes.md', content: 'extra', encoding: 'utf-8' },
        ],
      }),
    });

    const skillStore = buildSkillStore();
    const mastra = buildMastra({ storage: buildStorage(skillStore) });

    const result = (await BUILDER_REGISTRY_INSTALL_ROUTE.handler({
      mastra,
      ...ctx({ registryId: 'skills-sh', owner: 'a', repo: 'b', skillName: 'demo-skill' }),
    })) as any;

    expect(result).toEqual({
      storedSkillId: 'my-demo',
      name: 'My Demo',
      filesWritten: 2,
    });

    expect(skillStore.create).toHaveBeenCalledOnce();
    const createdSkill = skillStore.create.mock.calls[0]![0]!.skill;
    expect(createdSkill.id).toBe('my-demo');
    expect(createdSkill.name).toBe('My Demo');
    expect(createdSkill.description).toBe('Demo skill imported from skills.sh');
    // Frontmatter must be stripped from the agent-facing instructions field;
    // it's already lifted into name/description columns above. Per the Agent
    // Skills spec, frontmatter is metadata, not instructions.
    expect(createdSkill.instructions).toBe('Body content.');
    expect(createdSkill.instructions).not.toMatch(/^---/);
    expect(createdSkill.metadata).toEqual({
      origin: { type: 'skills-sh', owner: 'a', repo: 'b', skillName: 'demo-skill' },
    });
    expect(createdSkill.visibility).toBe('public'); // no caller -> public
    expect(createdSkill.files).toHaveLength(2);
    expect(createdSkill.files[1]).toEqual({
      name: 'references',
      type: 'folder',
      children: [{ name: 'notes.md', type: 'file', content: 'extra' }],
    });
  });

  it('falls back to skillName when SKILL.md is missing or has no frontmatter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        skillId: 'plain-skill',
        owner: 'a',
        repo: 'b',
        branch: 'main',
        files: [{ path: 'README.md', content: 'no frontmatter here', encoding: 'utf-8' }],
      }),
    });

    const skillStore = buildSkillStore();
    const mastra = buildMastra({ storage: buildStorage(skillStore) });

    const result = (await BUILDER_REGISTRY_INSTALL_ROUTE.handler({
      mastra,
      ...ctx({ registryId: 'skills-sh', owner: 'a', repo: 'b', skillName: 'plain-skill' }),
    })) as any;

    expect(result.name).toBe('plain-skill');
    expect(result.storedSkillId).toBe('plain-skill');
    const createdSkill = skillStore.create.mock.calls[0]![0]!.skill;
    expect(createdSkill.description).toBe('Imported from a/b');
    // No SKILL.md at all -> instructions falls back to the description so
    // resolved.snapshot.instructions stays non-empty.
    expect(createdSkill.instructions).toBe('Imported from a/b');
  });

  it('preserves SKILL.md body verbatim when there is no frontmatter to strip', async () => {
    const skillMd = '# Plain Skill\n\nNo frontmatter, just body.';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        skillId: 'no-frontmatter-skill',
        owner: 'a',
        repo: 'b',
        branch: 'main',
        files: [{ path: 'SKILL.md', content: skillMd, encoding: 'utf-8' }],
      }),
    });

    const skillStore = buildSkillStore();
    const mastra = buildMastra({ storage: buildStorage(skillStore) });

    await BUILDER_REGISTRY_INSTALL_ROUTE.handler({
      mastra,
      ...ctx({ registryId: 'skills-sh', owner: 'a', repo: 'b', skillName: 'no-frontmatter-skill' }),
    });

    const createdSkill = skillStore.create.mock.calls[0]![0]!.skill;
    expect(createdSkill.instructions).toBe(skillMd);
  });

  it('409s when a skill with the derived id already exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        skillId: 'taken',
        owner: 'a',
        repo: 'b',
        branch: 'main',
        files: [{ path: 'SKILL.md', content: '# taken', encoding: 'utf-8' }],
      }),
    });

    const skillStore = buildSkillStore();
    skillStore._skills.set('taken', { id: 'taken' });
    const mastra = buildMastra({ storage: buildStorage(skillStore) });

    await expect(
      BUILDER_REGISTRY_INSTALL_ROUTE.handler({
        mastra,
        ...ctx({ registryId: 'skills-sh', owner: 'a', repo: 'b', skillName: 'taken' }),
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(skillStore.create).not.toHaveBeenCalled();
  });

  it('rejects path traversal attempts in upstream files', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        skillId: 'evil',
        owner: 'a',
        repo: 'b',
        branch: 'main',
        files: [{ path: '../../escape.txt', content: 'pwned', encoding: 'utf-8' }],
      }),
    });

    const skillStore = buildSkillStore();
    const mastra = buildMastra({ storage: buildStorage(skillStore) });

    await expect(
      BUILDER_REGISTRY_INSTALL_ROUTE.handler({
        mastra,
        ...ctx({ registryId: 'skills-sh', owner: 'a', repo: 'b', skillName: 'evil' }),
      }),
    ).rejects.toThrow();
    expect(skillStore.create).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Route metadata
// =============================================================================

describe('Route metadata', () => {
  it('list-registries route uses GET + correct path + stored-skills:read permission', () => {
    expect(LIST_BUILDER_REGISTRIES_ROUTE.method).toBe('GET');
    expect(LIST_BUILDER_REGISTRIES_ROUTE.path).toBe('/editor/builder/registries');
    expect(LIST_BUILDER_REGISTRIES_ROUTE.requiresPermission).toBe('stored-skills:read');
    expect(LIST_BUILDER_REGISTRIES_ROUTE.requiresAuth).toBe(true);
  });

  it('search/popular/preview routes are GET + stored-skills:read', () => {
    for (const route of [
      BUILDER_REGISTRY_SEARCH_ROUTE,
      BUILDER_REGISTRY_POPULAR_ROUTE,
      BUILDER_REGISTRY_PREVIEW_ROUTE,
    ]) {
      expect(route.method).toBe('GET');
      expect(route.requiresPermission).toBe('stored-skills:read');
      expect(route.requiresAuth).toBe(true);
    }
  });

  it('install route is POST + stored-skills:write', () => {
    expect(BUILDER_REGISTRY_INSTALL_ROUTE.method).toBe('POST');
    expect(BUILDER_REGISTRY_INSTALL_ROUTE.path).toBe('/editor/builder/registries/:registryId/install');
    expect(BUILDER_REGISTRY_INSTALL_ROUTE.requiresPermission).toBe('stored-skills:write');
    expect(BUILDER_REGISTRY_INSTALL_ROUTE.requiresAuth).toBe(true);
  });
});
