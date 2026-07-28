/**
 * Public headless / programmatic API for MastraCode.
 *
 * Programmatic (CI / Node) usage:
 * ```ts
 * import { createMastraCode } from 'mastracode';
 * import { runMC } from 'mastracode/headless';
 *
 * const { controller, session } = await createMastraCode({ settingsPath });
 * const run = runMC({ controller, session, prompt: 'Fix the bug' });
 * for await (const event of run) { ... } // optional live events
 * const result = await run.result;        // typed RunMCResult
 * ```
 *
 * The CLI adapter (`runMCCli`) wraps the same `createMastraCode` → `runMC` flow.
 */

// Core runner
export { runMC } from './run-mc.js';

// Resolution policy
export { autoApprovePolicy, denyPolicy, permissionModeToPolicy } from './policy.js';

// Formatters (pure, sink-agnostic)
export {
  formatHuman,
  formatJsonl,
  renderTextResult,
  renderJsonResult,
  createHumanFormatState,
  truncate,
} from './format.js';
export type { FormattedOutput, HumanFormatState } from './format.js';

// CLI adapter
export { runMCCli, hasHeadlessFlag, parseHeadlessArgs, printHeadlessUsage } from './cli.js';
export type { HeadlessArgs, OutputMode } from './cli.js';

// Shared types
export type {
  RunMCOptions,
  RunMCResult,
  RunMCStatus,
  RunMCUsage,
  RunMCToolCall,
  RunMCToolResult,
  RunMCError,
  RunMCThreadOptions,
  MCRun,
  RunMCGoalOptions,
  ResolutionPolicy,
  RunMode,
  ThinkingLevel,
  PermissionMode,
} from './types.js';
export { VALID_MODES, VALID_THINKING_LEVELS, VALID_PERMISSION_MODES } from './types.js';
