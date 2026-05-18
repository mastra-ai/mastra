import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import {
  SKILLS_SH_API_URL,
  SKILLS_SH_DIR,
  assertSafeFilePath,
  assertSafeSkillName,
  fetchSkillFiles,
  getPopularSkillsSh,
  previewSkillsSh,
  searchSkillsSh,
} from './skills-sh-shared';

describe('skills-sh-shared constants', () => {
  it('points SKILLS_SH_DIR at the .agents/skills convention', () => {
    expect(SKILLS_SH_DIR).toBe('.agents/skills');
  });

  it('exposes the skills.sh API URL', () => {
    expect(SKILLS_SH_API_URL).toBe('https://skills-api-production.up.railway.app');
  });
});

describe('assertSafeSkillName', () => {
  it.each(['mastra', 'my-skill', 'skill_v2', 'a1b2c3', 'A1', 'foo-bar_baz-1'])('accepts %s', name => {
    expect(assertSafeSkillName(name)).toBe(name);
  });

  it.each(['', '-foo', '_foo', '../escape', 'foo/bar', 'foo bar', 'foo.bar', 'foo$bar'])('rejects %s', name => {
    expect(() => assertSafeSkillName(name)).toThrow(HTTPException);
  });
});

describe('assertSafeFilePath', () => {
  it.each(['SKILL.md', 'src/index.ts', 'a/b/c/d.txt', 'foo/bar.md'])('accepts %s', path => {
    expect(assertSafeFilePath(path)).toBe(path);
  });

  it('rejects absolute paths', () => {
    expect(() => assertSafeFilePath('/etc/passwd')).toThrow(HTTPException);
    expect(() => assertSafeFilePath('C:/Windows/System32')).toThrow(HTTPException);
  });

  it('rejects path traversal', () => {
    expect(() => assertSafeFilePath('../escape')).toThrow(HTTPException);
    expect(() => assertSafeFilePath('foo/../bar')).toThrow(HTTPException);
    expect(() => assertSafeFilePath('./local')).toThrow(HTTPException);
  });

  it('rejects backslash-based path traversal', () => {
    expect(() => assertSafeFilePath('..\\escape')).toThrow(HTTPException);
    expect(() => assertSafeFilePath('foo\\..\\bar')).toThrow(HTTPException);
    expect(() => assertSafeFilePath('\\absolute\\path')).toThrow(HTTPException);
    expect(() => assertSafeFilePath('C:\\Windows\\System32')).toThrow(HTTPException);
  });
});

describe('searchSkillsSh', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllGlobals();
  });

  it('shapes upstream response into the wire format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        skills: [
          {
            skillId: 'mastra',
            name: 'mastra',
            installs: 42,
            source: 'mastra-ai/mastra/mastra',
            owner: 'mastra-ai',
            repo: 'mastra',
            githubUrl: '',
            displayName: 'Mastra',
          },
        ],
        total: 1,
      }),
    });

    const result = await searchSkillsSh({ q: 'mastra', limit: 10 });

    expect(result).toEqual({
      query: 'mastra',
      searchType: 'query',
      skills: [{ id: 'mastra', name: 'mastra', installs: 42, topSource: 'mastra-ai/mastra/mastra' }],
      count: 1,
    });
  });

  it('throws HTTPException 502 on upstream failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' });

    await expect(searchSkillsSh({ q: 'foo', limit: 10 })).rejects.toThrow(HTTPException);
  });
});

describe('getPopularSkillsSh', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllGlobals();
  });

  it('translates offset to a 1-indexed page parameter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ skills: [], total: 0 }),
    });

    await getPopularSkillsSh({ limit: 10, offset: 20 });

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('pageSize=10');
    expect(url).toContain('page=3');
  });

  it('uses page=1 when offset is zero', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ skills: [], total: 0 }),
    });

    await getPopularSkillsSh({ limit: 10, offset: 0 });

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('page=1');
  });

  it('echoes limit and offset in the response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ skills: [], total: 0 }),
    });

    const result = await getPopularSkillsSh({ limit: 25, offset: 50 });
    expect(result.limit).toBe(25);
    expect(result.offset).toBe(50);
  });
});

describe('previewSkillsSh', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllGlobals();
  });

  it('prefers instructions over raw', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ instructions: 'use this skill', raw: 'raw markdown' }),
    });

    const result = await previewSkillsSh({ owner: 'a', repo: 'b', skillName: 'c' });
    expect(result.content).toBe('use this skill');
  });

  it('falls back to raw when instructions are missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw: 'raw markdown' }),
    });

    const result = await previewSkillsSh({ owner: 'a', repo: 'b', skillName: 'c' });
    expect(result.content).toBe('raw markdown');
  });

  it('throws 404 when upstream is not OK', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

    await expect(previewSkillsSh({ owner: 'a', repo: 'b', skillName: 'missing' })).rejects.toThrow(HTTPException);
  });

  it('throws 404 when upstream returns empty content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await expect(previewSkillsSh({ owner: 'a', repo: 'b', skillName: 'empty' })).rejects.toThrow(HTTPException);
  });
});

describe('fetchSkillFiles', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllGlobals();
  });

  it('returns the upstream response unchanged on success', async () => {
    const payload = {
      skillId: 'skill-1',
      owner: 'a',
      repo: 'b',
      branch: 'main',
      files: [{ path: 'SKILL.md', content: '# hi', encoding: 'utf-8' as const }],
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => payload });

    const result = await fetchSkillFiles('a', 'b', 'skill-1');
    expect(result).toEqual(payload);
  });

  it('returns null on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

    const result = await fetchSkillFiles('a', 'b', 'missing');
    expect(result).toBeNull();
  });

  it('throws on non-404 upstream errors', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' });

    await expect(fetchSkillFiles('a', 'b', 'broken')).rejects.toThrow();
  });
});
