/**
 * Skills.sh API
 * Public exports for the skills API server
 */

export { createSkillsApiServer, skillsRouter } from './server.js';
export type { SkillsApiServerOptions } from './server.js';

export type { RegistrySkill, PaginatedSkillsResponse, SkillSearchParams, Category } from './registry/types.js';

export { skills, categories, getAllTags, getAllAuthors } from './registry/data.js';
