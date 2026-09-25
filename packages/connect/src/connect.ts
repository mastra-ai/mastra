/**
 * @deprecated Use `tools` from `@mastra/connect` instead. This module is a
 * thin re-export retained for one release cycle so downstream consumers keep
 * working; it will be removed in the next minor.
 */
import { tools } from './tools.js';
import type { ToolsIntegrationOptions, ToolsOptions, ToolsResolver } from './tools.js';

/**
 * @deprecated Renamed to {@link ToolsIntegrationOptions}.
 */
export type ConnectIntegrationOptions = ToolsIntegrationOptions;

/**
 * @deprecated Renamed to {@link ToolsOptions}.
 */
export type ConnectOptions = ToolsOptions;

/**
 * @deprecated Renamed to {@link ToolsResolver}.
 */
export type ConnectTools = ToolsResolver;

/**
 * @deprecated Renamed to {@link tools}.
 *
 * `connect(options)` is a drop-in alias for `tools(options)`. Prefer `tools`
 * from `@mastra/connect` in new code; this export will be removed in the next
 * minor version.
 */
export function connect(options: ConnectOptions = {}): ConnectTools {
  return tools(options);
}
