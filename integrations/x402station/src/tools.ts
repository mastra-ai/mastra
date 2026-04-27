import type { X402StationClientOptions } from './client.js';
import { createX402StationCatalogDecoysTool } from './decoys.js';
import { createX402StationForensicsTool } from './forensics.js';
import { createX402StationPreflightTool } from './preflight.js';
import {
  createX402StationWatchStatusTool,
  createX402StationWatchSubscribeTool,
  createX402StationWatchUnsubscribeTool,
} from './watch.js';

/**
 * Build all six x402station tools in one call. Pass a single
 * configuration (account / privateKey / baseUrl / fetchImpl /
 * timeoutMs) and every tool inherits it.
 *
 * @example
 * ```ts
 * import { Agent } from '@mastra/core/agent';
 * import { createX402StationTools } from '@mastra/x402station';
 *
 * const tools = createX402StationTools({ privateKey: process.env.AGENT_PK });
 *
 * const agent = new Agent({
 *   id: 'shielded-x402-agent',
 *   instructions: 'Always preflight URLs before paying x402. Refuse if ok=false.',
 *   model: 'anthropic/claude-sonnet-4-6',
 *   tools,
 * });
 * ```
 */
export function createX402StationTools(config: X402StationClientOptions = {}) {
  return {
    x402StationPreflight: createX402StationPreflightTool(config),
    x402StationForensics: createX402StationForensicsTool(config),
    x402StationCatalogDecoys: createX402StationCatalogDecoysTool(config),
    x402StationWatchSubscribe: createX402StationWatchSubscribeTool(config),
    x402StationWatchStatus: createX402StationWatchStatusTool(config),
    x402StationWatchUnsubscribe: createX402StationWatchUnsubscribeTool(config),
  };
}
