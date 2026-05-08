import {
  createMrscraperBulkRerunAiScraperTool,
  createMrscraperCreateAiScraperTool,
  createMrscraperRerunAiScraperTool,
} from './ai-scrapers.js';
import type { MrScraperClientOptions } from './config.js';
import { createMrscraperFetchHtmlTool } from './fetch-html.js';
import { createMrscraperGoogleSerpSyncTool } from './google-serp.js';
import {
  createMrscraperBulkRerunManualScraperTool,
  createMrscraperRerunManualScraperTool,
} from './manual-scrapers.js';
import { createMrscraperGetAllResultsTool, createMrscraperGetResultByIdTool } from './results.js';

/**
 * All MrScraper tools with shared credential configuration.
 *
 * Matches the default tool surface of the MrScraper MCP server (`stdio` / HTTP `/mcp`).
 */
export function createMrscraperTools(config?: MrScraperClientOptions) {
  return {
    mrscraperFetchHtml: createMrscraperFetchHtmlTool(config),
    mrscraperGoogleSerpSync: createMrscraperGoogleSerpSyncTool(config),
    mrscraperCreateAiScraper: createMrscraperCreateAiScraperTool(config),
    mrscraperRerunAiScraper: createMrscraperRerunAiScraperTool(config),
    mrscraperBulkRerunAiScraper: createMrscraperBulkRerunAiScraperTool(config),
    mrscraperRerunManualScraper: createMrscraperRerunManualScraperTool(config),
    mrscraperBulkRerunManualScraper: createMrscraperBulkRerunManualScraperTool(config),
    mrscraperGetAllResults: createMrscraperGetAllResultsTool(config),
    mrscraperGetResultById: createMrscraperGetResultByIdTool(config),
  };
}
