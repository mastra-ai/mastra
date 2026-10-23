import type { MCPClientTasksOptions } from '../types';

/** Normalises a server's `tasks` option; `undefined` means tasks are off. */
export function resolveTasksOptions(
  serverName: string,
  option: boolean | MCPClientTasksOptions | undefined,
): MCPClientTasksOptions | undefined {
  if (!option) return undefined;
  if (option === true) return {};
  for (const key of ['pollIntervalMs', 'maxWaitMs'] as const) {
    const value = option[key];
    if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
      throw new RangeError(`MCP server '${serverName}': tasks.${key} must be a positive integer`);
    }
  }
  return option;
}
