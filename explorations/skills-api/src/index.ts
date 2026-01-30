/**
 * Skills.sh API
 * Public exports for the skills API server
 */

export { createSkillsApiServer, skillsRouter } from './server.js';
export type { SkillsApiServerOptions } from './server.js';

export type {
  RegistrySkill,
  ScrapedData,
  PaginatedSkillsResponse,
  SkillSearchParams,
  Source,
} from './registry/types.js';

export {
  skills,
  metadata,
  getSources,
  getOwners,
  getTopSkills,
  getTopSources,
  getSkills,
  getMetadata,
  reloadData,
} from './registry/data.js';

// Storage exports
export {
  loadSkillsData,
  saveSkillsData,
  getDataFilePath,
  isUsingExternalStorage,
  getStorageInfo,
} from './storage/index.js';
export { supportedAgents, getAgent } from './registry/agents.js';
export type { SupportedAgent } from './registry/agents.js';

// Scraper exports
export { scrapeSkills, enrichSkills, scrapeAndSave } from './scraper/scrape.js';
export type { ScrapedSkill, EnrichedSkill } from './scraper/scrape.js';

// GitHub fetch exports
export { fetchSkillFromGitHub, listSkillsInRepo } from './github/index.js';
export type { SkillContent, FetchSkillResult } from './github/index.js';

// Scheduler exports
export {
  refreshSkillsData,
  startRefreshScheduler,
  stopRefreshScheduler,
  isSchedulerRunning,
  isRefreshInProgress,
  getLastRefreshResult,
  getCurrentDataTimestamp,
} from './scheduler/index.js';
export type { RefreshResult, RefreshSchedulerOptions } from './scheduler/index.js';
