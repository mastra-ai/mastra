/** HTTP endpoints used by the MrScraper platform APIs (aligned with mrscraper-mcp). */

export const FETCH_HTML_API_BASE = 'https://api.mrscraper.com';

const API_APP_BASE = 'https://api.app.mrscraper.com';

export const SCRAPERS_AI = `${API_APP_BASE}/api/v1/scrapers-ai`;
export const SCRAPERS_AI_RERUN = `${API_APP_BASE}/api/v1/scrapers-ai-rerun`;
export const SCRAPERS_AI_RERUN_BULK = `${API_APP_BASE}/api/v1/scrapers-ai-rerun/bulk`;
export const SCRAPERS_MANUAL_RERUN = `${API_APP_BASE}/api/v1/scrapers-manual-rerun`;
export const SCRAPERS_MANUAL_RERUN_BULK = `${API_APP_BASE}/api/v1/scrapers-manual-rerun/bulk`;
export const RESULTS = `${API_APP_BASE}/api/v1/results`;

export const GOOGLE_SERP_SYNC = 'https://sync.scraper.mrscraper.com/api/google/serp/sync';

export const UNAUTHORIZED_APP =
  'Unauthorized or invalid token. Please go to https://app.mrscraper.com to get your token.';
