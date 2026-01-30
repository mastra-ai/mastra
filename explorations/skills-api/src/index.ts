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
  reloadDataAsync,
  initializeData,
} from './registry/data.js';

// Storage exports
export {
  loadSkillsData,
  loadSkillsDataAsync,
  saveSkillsData,
  saveSkillsDataAsync,
  getDataFilePath,
  isUsingExternalStorage,
  getActiveStorageType,
  getStorageInfo,
  isS3Configured,
} from './storage/index.js';
export type { StorageType } from './storage/index.js';
export { supportedAgents, getAgent } from './registry/agents.js';
export type { SupportedAgent } from './registry/agents.js';

// Scraper exports
export { scrapeSkills, enrichSkills, scrapeAndSave } from './scraper/scrape.js';
export type { ScrapedSkill, EnrichedSkill } from './scraper/scrape.js';
export { validateScrapedData, isDataUsable } from './scraper/validate.js';
export type { ValidationResult, ValidationOptions } from './scraper/validate.js';

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
