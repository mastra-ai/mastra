/**
 * Server-only exports for the loop module.
 * These exports contain Node.js dependencies and should not be imported in browser builds.
 *
 * @example
 * ```typescript
 * // Server-side only
 * import { createRunCommandTool } from '@mastra/core/loop/server';
 * ```
 *
 * @security WARNING: createRunCommandTool executes shell commands and poses significant
 * security risks if misused. NEVER use with untrusted input. Always configure:
 * - `allowedCommands`: Restrict which commands can be executed
 * - `allowedBasePaths`: Restrict working directories
 * - Consider additional sandboxing (containers, VMs) for production
 *
 * See {@link RunCommandToolOptions} for configuration details.
 */
export { createRunCommandTool, type RunCommandToolOptions } from './network/run-command-tool';
