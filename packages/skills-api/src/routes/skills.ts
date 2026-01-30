/**
 * Skills API Routes
 * Provides endpoints for browsing, searching, and retrieving skills
 */

import { Hono } from 'hono';
import { skills, categories, getAllTags, getAllAuthors } from '../registry/index.js';
import type { PaginatedSkillsResponse, SkillSearchParams } from '../registry/types.js';

const skillsRouter = new Hono();

/**
 * Helper to search skills based on query parameters
 */
function searchSkills(params: SkillSearchParams): PaginatedSkillsResponse {
  let filtered = [...skills];

  // Text search across name, description, and tags
  if (params.query) {
    const query = params.query.toLowerCase();
    filtered = filtered.filter(
      skill =>
        skill.name.toLowerCase().includes(query) ||
        skill.displayName.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.tags.some(tag => tag.toLowerCase().includes(query)),
    );
  }

  // Filter by category
  if (params.category) {
    filtered = filtered.filter(skill => skill.category === params.category);
  }

  // Filter by tags
  if (params.tags && params.tags.length > 0) {
    filtered = filtered.filter(skill => params.tags!.some(tag => skill.tags.includes(tag)));
  }

  // Filter by author
  if (params.author) {
    filtered = filtered.filter(skill => skill.author === params.author);
  }

  // Filter by featured
  if (params.featured) {
    filtered = filtered.filter(skill => skill.featured === true);
  }

  // Sort
  const sortBy = params.sortBy || 'downloads';
  const sortOrder = params.sortOrder || 'desc';

  filtered.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'downloads':
        comparison = (a.downloads || 0) - (b.downloads || 0);
        break;
      case 'stars':
        comparison = (a.stars || 0) - (b.stars || 0);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      default:
        comparison = (a.downloads || 0) - (b.downloads || 0);
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
 * - category: Filter by category
 * - tags: Filter by tags (comma-separated)
 * - author: Filter by author
 * - sortBy: Sort field (name, downloads, stars, createdAt, updatedAt)
 * - sortOrder: Sort order (asc, desc)
 * - page: Page number (1-indexed)
 * - pageSize: Items per page (default: 20, max: 100)
 * - featured: Only show featured skills (true/false)
 */
skillsRouter.get('/', c => {
  const query = c.req.query('query');
  const category = c.req.query('category');
  const tagsParam = c.req.query('tags');
  const author = c.req.query('author');
  const sortBy = c.req.query('sortBy') as SkillSearchParams['sortBy'];
  const sortOrder = c.req.query('sortOrder') as SkillSearchParams['sortOrder'];
  const page = parseInt(c.req.query('page') || '1', 10);
  const pageSize = parseInt(c.req.query('pageSize') || '20', 10);
  const featured = c.req.query('featured') === 'true';

  const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined;

  const result = searchSkills({
    query,
    category,
    tags,
    author,
    sortBy,
    sortOrder,
    page,
    pageSize,
    featured: featured || undefined,
  });

  return c.json(result);
});

/**
 * GET /api/skills/featured
 * Get featured skills
 */
skillsRouter.get('/featured', c => {
  const featuredSkills = skills.filter(s => s.featured === true);
  return c.json({
    skills: featuredSkills,
    total: featuredSkills.length,
  });
});

/**
 * GET /api/skills/categories
 * Get all categories with skill counts
 */
skillsRouter.get('/categories', c => {
  return c.json({
    categories,
    total: categories.length,
  });
});

/**
 * GET /api/skills/tags
 * Get all available tags
 */
skillsRouter.get('/tags', c => {
  const tags = getAllTags();
  return c.json({
    tags,
    total: tags.length,
  });
});

/**
 * GET /api/skills/authors
 * Get all skill authors
 */
skillsRouter.get('/authors', c => {
  const authors = getAllAuthors();
  return c.json({
    authors,
    total: authors.length,
  });
});

/**
 * GET /api/skills/stats
 * Get registry statistics
 */
skillsRouter.get('/stats', c => {
  const totalDownloads = skills.reduce((sum, s) => sum + (s.downloads || 0), 0);
  const totalStars = skills.reduce((sum, s) => sum + (s.stars || 0), 0);

  return c.json({
    totalSkills: skills.length,
    totalDownloads,
    totalStars,
    totalCategories: categories.length,
    totalTags: getAllTags().length,
    totalAuthors: getAllAuthors().length,
  });
});

/**
 * GET /api/skills/:name
 * Get a specific skill by name
 */
skillsRouter.get('/:name', c => {
  const name = c.req.param('name');
  const skill = skills.find(s => s.name === name);

  if (!skill) {
    return c.json({ error: `Skill "${name}" not found` }, 404);
  }

  return c.json(skill);
});

/**
 * GET /api/skills/:name/install
 * Get installation instructions for a skill
 */
skillsRouter.get('/:name/install', c => {
  const name = c.req.param('name');
  const skill = skills.find(s => s.name === name);

  if (!skill) {
    return c.json({ error: `Skill "${name}" not found` }, 404);
  }

  const instructions: {
    npm?: string;
    github?: string;
    manual?: string;
  } = {};

  if (skill.npmPackage) {
    instructions.npm = `npm install ${skill.npmPackage}`;
  }

  if (skill.githubRepo) {
    instructions.github = `git clone https://github.com/${skill.githubRepo}.git`;
  }

  instructions.manual = `
# Manual Installation

1. Create a skills directory in your project:
   mkdir -p .mastra/skills/${skill.name}

2. Create SKILL.md with the skill definition:
   # See https://agentskills.io for the full specification

3. Configure in your Mastra workspace:
   const workspace = new Workspace({
     skills: ['.mastra/skills'],
   });
`.trim();

  return c.json({
    skill: {
      name: skill.name,
      displayName: skill.displayName,
      version: skill.version,
    },
    instructions,
  });
});

export { skillsRouter };
