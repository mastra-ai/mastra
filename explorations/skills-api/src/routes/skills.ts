/**
 * Skills API Routes
 * Provides endpoints for browsing, searching, and retrieving skills
 */

import { Hono } from 'hono';

import { fetchSkillFromGitHub } from '../github/index.js';
import {
  getSkills,
  getMetadata,
  getSources,
  getOwners,
  getTopSkills,
  getTopSources,
  supportedAgents,
} from '../registry/index.js';
import type { PaginatedSkillsResponse, SkillSearchParams } from '../registry/types.js';

const skillsRouter = new Hono();

/**
 * Helper to search skills based on query parameters
 */
function searchSkills(params: SkillSearchParams): PaginatedSkillsResponse {
  let filtered = [...getSkills()];

  // Text search across name, displayName, source
  if (params.query) {
    const query = params.query.toLowerCase();
    filtered = filtered.filter(
      skill =>
        skill.name.toLowerCase().includes(query) ||
        skill.displayName.toLowerCase().includes(query) ||
        skill.source.toLowerCase().includes(query) ||
        skill.skillId.toLowerCase().includes(query),
    );
  }

  // Filter by owner
  if (params.owner) {
    filtered = filtered.filter(skill => skill.owner === params.owner);
  }

  // Filter by repo
  if (params.repo) {
    filtered = filtered.filter(skill => skill.source === params.repo);
  }

  // Sort
  const sortBy = params.sortBy || 'installs';
  const sortOrder = params.sortOrder || 'desc';

  filtered.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'installs':
        comparison = a.installs - b.installs;
        break;
      default:
        comparison = a.installs - b.installs;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });

  // Pagination
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedSkills = filtered.slice(startIndex, startIndex + pageSize);

  return {
    skills: paginatedSkills,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * GET /api/skills
 * List and search skills with pagination
 *
 * Query Parameters:
 * - query: Search text
 * - owner: Filter by GitHub owner
 * - repo: Filter by repository (owner/repo format)
 * - sortBy: Sort field (name, installs)
 * - sortOrder: Sort order (asc, desc)
 * - page: Page number (1-indexed)
 * - pageSize: Items per page (default: 20, max: 100)
 */
skillsRouter.get('/', c => {
  const query = c.req.query('query');
  const owner = c.req.query('owner');
  const repo = c.req.query('repo');
  const sortBy = c.req.query('sortBy') as SkillSearchParams['sortBy'];
  const sortOrder = c.req.query('sortOrder') as SkillSearchParams['sortOrder'];
  const page = parseInt(c.req.query('page') || '1', 10);
  const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

  const result = searchSkills({
    query,
    owner,
    repo,
    sortBy,
    sortOrder,
    page,
    pageSize,
  });

  return c.json(result);
});

/**
 * GET /api/skills/top
 * Get top skills by installs
 */
skillsRouter.get('/top', c => {
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '100', 10)));
  const topSkills = getTopSkills(limit);
  return c.json({
    skills: topSkills,
    total: topSkills.length,
  });
});

/**
 * GET /api/skills/sources
 * Get all source repositories with skill counts
 */
skillsRouter.get('/sources', c => {
  const sources = getSources();
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '50', 10)));

  const total = sources.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedSources = sources.slice(startIndex, startIndex + pageSize);

  return c.json({
    sources: paginatedSources,
    total,
    page,
    pageSize,
    totalPages,
  });
});

/**
 * GET /api/skills/sources/top
 * Get top sources by total installs
 */
skillsRouter.get('/sources/top', c => {
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));
  const topSources = getTopSources(limit);
  return c.json({
    sources: topSources,
    total: topSources.length,
  });
});

/**
 * GET /api/skills/owners
 * Get all skill owners with counts
 */
skillsRouter.get('/owners', c => {
  const owners = getOwners();
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '50', 10)));

  const total = owners.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedOwners = owners.slice(startIndex, startIndex + pageSize);

  return c.json({
    owners: paginatedOwners,
    total,
    page,
    pageSize,
    totalPages,
  });
});

/**
 * GET /api/skills/agents
 * Get all supported AI agents
 */
skillsRouter.get('/agents', c => {
  return c.json({
    agents: supportedAgents,
    total: supportedAgents.length,
  });
});

/**
 * GET /api/skills/stats
 * Get registry statistics
 */
skillsRouter.get('/stats', c => {
  const skills = getSkills();
  const metadata = getMetadata();
  const totalInstalls = skills.reduce((sum, s) => sum + s.installs, 0);

  return c.json({
    scrapedAt: metadata.scrapedAt,
    totalSkills: metadata.totalSkills,
    totalSources: metadata.totalSources,
    totalOwners: metadata.totalOwners,
    totalInstalls,
  });
});

/**
 * GET /api/skills/by-source/:owner/:repo
 * Get all skills from a specific repository
 */
skillsRouter.get('/by-source/:owner/:repo', c => {
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  const source = `${owner}/${repo}`;

  const repoSkills = getSkills().filter(s => s.source === source);

  if (repoSkills.length === 0) {
    return c.json({ error: `No skills found for source "${source}"` }, 404);
  }

  return c.json({
    source,
    githubUrl: `https://github.com/${source}`,
    skills: repoSkills.sort((a, b) => b.installs - a.installs),
    total: repoSkills.length,
    totalInstalls: repoSkills.reduce((sum, s) => sum + s.installs, 0),
  });
});

/**
 * GET /api/skills/:skillId
 * Get a specific skill by ID
 * Note: skillId may not be unique across sources, returns first match
 */
skillsRouter.get('/:skillId', c => {
  const skillId = c.req.param('skillId');
  const skill = getSkills().find(s => s.skillId === skillId || s.name === skillId);

  if (!skill) {
    return c.json({ error: `Skill "${skillId}" not found` }, 404);
  }

  return c.json(skill);
});

/**
 * GET /api/skills/:owner/:repo/:skillId
 * Get a specific skill by source and ID
 */
skillsRouter.get('/:owner/:repo/:skillId', c => {
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  const skillId = c.req.param('skillId');
  const source = `${owner}/${repo}`;

  const skill = getSkills().find(s => s.source === source && (s.skillId === skillId || s.name === skillId));

  if (!skill) {
    return c.json({ error: `Skill "${skillId}" not found in source "${source}"` }, 404);
  }

  // Include install command
  const installCommand = `npx skills add ${source}/${skillId}`;

  return c.json({
    ...skill,
    installCommand,
  });
});

/**
 * GET /api/skills/:owner/:repo/:skillId/content
 * Fetch the full SKILL.md content from GitHub
 */
skillsRouter.get('/:owner/:repo/:skillId/content', async c => {
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  const skillId = c.req.param('skillId');
  const branch = c.req.query('branch') || 'main';

  const result = await fetchSkillFromGitHub(owner, repo, skillId, branch);

  if (!result.success) {
    return c.json({ error: result.error }, 404);
  }

  return c.json({
    source: `${owner}/${repo}`,
    skillId,
    path: result.path,
    metadata: result.content?.metadata,
    instructions: result.content?.instructions,
    raw: result.content?.raw,
  });
});

export { skillsRouter };
