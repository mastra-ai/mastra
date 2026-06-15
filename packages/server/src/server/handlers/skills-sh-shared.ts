/**
 * Shared skills.sh helpers
 *
 * Pure proxy + safety logic for talking to the skills.sh API. Used by:
 *   - Workspace skills.sh routes (filesystem-only install).
 *   - Builder registry routes (stored-skill install with optional workspace
 *     materialization).
 *
 * No workspace or stored-skill concepts leak into this module. Path resolution,
 * filesystem writes, and DB writes happen in the callers.
 */

import { HTTPException } from '../http-exception';

// =============================================================================
// Constants
// =============================================================================

/** Upstream skills.sh API base URL. */
export const SKILLS_SH_API_URL = 'https://skills-api-production.up.railway.app';

/**
 * Directory path for skills installed via skills.sh, relative to the workspace
 * filesystem root (or to a CompositeFilesystem mount). Matches the convention
 * shared with Claude Code and other agent runtimes.
 */
export const SKILLS_SH_DIR = '.agents/skills';

const SEARCH_TIMEOUT_MS = 10_000;
const PREVIEW_TIMEOUT_MS = 10_000;
const FILE_FETCH_TIMEOUT_MS = 30_000;

// =============================================================================
// Types
// =============================================================================

/** Single skill summary returned by search/popular endpoints. */
export interface SkillsShSkillSummary {
  id: string;
  name: string;
  installs: number;
  topSource: string;
}

export interface SkillsShSearchResult {
  query: string;
  searchType: 'query';
  skills: SkillsShSkillSummary[];
  count: number;
}

export interface SkillsShPopularResult {
  skills: SkillsShSkillSummary[];
  count: number;
  limit: number;
  offset: number;
}

/** A single file from the skills.sh files endpoint. */
export interface SkillFileEntry {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
}

/** Response from the skills.sh files endpoint. */
export interface SkillFilesResponse {
  skillId: string;
  owner: string;
  repo: string;
  branch: string;
  files: SkillFileEntry[];
}

// =============================================================================
// Safety validators
// =============================================================================

/**
 * Validate skill name to prevent path traversal attacks. Only allows
 * alphanumeric characters, hyphens, and underscores; must start with an
 * alphanumeric character.
 *
 * Throws an HTTP 400 on invalid input. Returns the validated name on success
 * so it can be used inline.
 */
const SKILL_NAME_REGEX = /^[a-z0-9][a-z0-9-_]*$/i;

export function assertSafeSkillName(name: string): string {
  if (!SKILL_NAME_REGEX.test(name)) {
    throw new HTTPException(400, {
      message: `Invalid skill name "${name}". Names must start with alphanumeric and contain only letters, numbers, hyphens, and underscores.`,
    });
  }
  return name;
}

/**
 * Validate that a file path is safe (no traversal, no absolute paths).
 * Prevents malicious API responses from writing files outside the skill
 * directory.
 */
export function assertSafeFilePath(filePath: string): string {
  if (filePath.startsWith('/') || filePath.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(filePath)) {
    throw new HTTPException(400, {
      message: `Invalid file path "${filePath}". Absolute paths are not allowed.`,
    });
  }
  // Normalize backslashes to forward slashes so Windows-style traversal
  // (e.g. "..\\..\\etc\\passwd") cannot bypass the segment check below.
  const segments = filePath.split(/[\\/]/);
  for (const segment of segments) {
    if (segment === '..' || segment === '.') {
      throw new HTTPException(400, {
        message: `Invalid file path "${filePath}". Path traversal is not allowed.`,
      });
    }
  }
  return filePath;
}

// =============================================================================
// API calls
// =============================================================================

interface UpstreamSkillsList {
  skills: Array<{
    skillId: string;
    name: string;
    installs: number;
    source: string;
    owner: string;
    repo: string;
    githubUrl: string;
    displayName: string;
  }>;
  total: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

/** Search skills.sh by query string. Throws HTTPException on upstream failure. */
export async function searchSkillsSh({ q, limit }: { q: string; limit: number }): Promise<SkillsShSearchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const url = `${SKILLS_SH_API_URL}/api/skills?query=${encodeURIComponent(q)}&pageSize=${limit}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new HTTPException(502, {
        message: `Skills API error: ${response.status} ${response.statusText}`,
      });
    }

    const data = (await response.json()) as UpstreamSkillsList;
    return {
      query: q,
      searchType: 'query',
      skills: data.skills.map(s => ({ id: s.skillId, name: s.name, installs: s.installs, topSource: s.source })),
      count: data.total,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Fetch the popular skills list from skills.sh. */
export async function getPopularSkillsSh({
  limit,
  offset,
}: {
  limit: number;
  offset: number;
}): Promise<SkillsShPopularResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const page = offset > 0 ? Math.floor(offset / limit) + 1 : 1;
    const url = `${SKILLS_SH_API_URL}/api/skills/top?pageSize=${limit}&page=${page}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new HTTPException(502, {
        message: `Skills API error: ${response.status} ${response.statusText}`,
      });
    }

    const data = (await response.json()) as UpstreamSkillsList;
    return {
      skills: data.skills.map(s => ({ id: s.skillId, name: s.name, installs: s.installs, topSource: s.source })),
      count: data.total,
      limit,
      offset,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch the rendered SKILL.md / instructions content for a single skill.
 * Returns the content string, or throws HTTPException(404) when the skill
 * doesn't exist or has no content.
 */
export async function previewSkillsSh({
  owner,
  repo,
  skillName,
}: {
  owner: string;
  repo: string;
  skillName: string;
}): Promise<{ content: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);

  try {
    const url = `${SKILLS_SH_API_URL}/api/skills/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(skillName)}/content`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      if (response.status === 404) {
        throw new HTTPException(404, {
          message: `Could not find skill "${skillName}" for ${owner}/${repo}`,
        });
      }
      throw new HTTPException(502, {
        message: `Skills API error: ${response.status} ${response.statusText}`,
      });
    }

    const data = (await response.json()) as { instructions?: string; raw?: string };
    const content = data.instructions || data.raw || '';

    if (!content) {
      throw new HTTPException(404, {
        message: `No content available for skill "${skillName}"`,
      });
    }

    return { content };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch the full file tree for a skill from the skills.sh files endpoint.
 * Returns null when the skill doesn't exist (404). Throws on other upstream
 * errors. Caller is responsible for validating each returned file path with
 * `assertSafeFilePath` before writing to disk.
 */
export async function fetchSkillFiles(
  owner: string,
  repo: string,
  skillName: string,
): Promise<SkillFilesResponse | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FILE_FETCH_TIMEOUT_MS);

  try {
    const url = `${SKILLS_SH_API_URL}/api/skills/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(skillName)}/files`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Skills API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as SkillFilesResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}
