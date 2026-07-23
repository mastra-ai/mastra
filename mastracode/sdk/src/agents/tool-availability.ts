import { WORKSPACE_TOOLS } from '@mastra/core/workspace';
import type { WorkspaceToolHookContext, WorkspaceToolsConfig } from '@mastra/core/workspace';
import { MC_TOOLS, TOOL_NAME_OVERRIDES } from '../tool-names.js';
import { getLocalPlansRelativeDir, isPlanFilePath } from '../utils/plans.js';

const PLAN_MODE_WRITE_TOOL_NAMES = new Set<string>([
  WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
  WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
]);

function getRequestContextValue(requestContext: unknown, key: string): unknown {
  if (!requestContext) return undefined;
  if (typeof (requestContext as { get?: unknown }).get === 'function') {
    return (requestContext as { get: (key: string) => unknown }).get(key);
  }
  return (requestContext as Record<string, unknown>)[key];
}

/**
 * Subset of the real `HarnessRequestContext` shape (see
 * packages/core/src/harness/types.ts). The mode is a string property
 * (`session.modeId`) and live state is read via `session.state.get()`.
 */
interface PlanModeGuardHarness {
  session?: {
    modeId?: unknown;
    state?: { get?: () => unknown };
  };
}

function getHarnessContext(context: unknown): PlanModeGuardHarness | undefined {
  const requestContext = (context as { requestContext?: unknown } | undefined)?.requestContext;
  const harness = getRequestContextValue(requestContext, 'harness');
  return harness && typeof harness === 'object' ? (harness as PlanModeGuardHarness) : undefined;
}

function getHarnessState(harness: PlanModeGuardHarness | undefined): Record<string, unknown> | undefined {
  const state = harness?.session?.state?.get?.();
  return state && typeof state === 'object' ? (state as Record<string, unknown>) : undefined;
}

function getHarnessModeId(harness: PlanModeGuardHarness | undefined): string | undefined {
  const modeId = harness?.session?.modeId ?? getHarnessState(harness)?.modeId;
  return typeof modeId === 'string' ? modeId : undefined;
}

function getHarnessProjectPath(harness: PlanModeGuardHarness | undefined): string | undefined {
  const projectPath = getHarnessState(harness)?.projectPath;
  return typeof projectPath === 'string' ? projectPath : undefined;
}

function getToolInputPath(input: unknown): string | undefined {
  const toolPath = (input as { path?: unknown } | undefined)?.path;
  return typeof toolPath === 'string' ? toolPath : undefined;
}

const PLAN_DIR_HINT = `${getLocalPlansRelativeDir()}/`;

export function guardPlanModePlanFileWrites({ workspaceToolName, input, context }: WorkspaceToolHookContext) {
  if (!PLAN_MODE_WRITE_TOOL_NAMES.has(workspaceToolName)) return;

  const harness = getHarnessContext(context);
  if (getHarnessModeId(harness) !== 'plan') return;

  const projectPath = getHarnessProjectPath(harness);
  const inputPath = getToolInputPath(input);
  if (!projectPath || !inputPath) {
    return {
      proceed: false as const,
      output: `Plan mode can only write plan files inside ${PLAN_DIR_HINT}.`,
    };
  }

  // Plan mode may write any `.md` file directly inside `.mastracode/plans/`, but
  // nothing else in the project.
  if (isPlanFilePath(projectPath, inputPath)) return;

  return {
    proceed: false as const,
    output: `Plan mode can only write plan files inside ${PLAN_DIR_HINT}. Refusing to edit ${inputPath}.`,
  };
}

export const MASTRACODE_WORKSPACE_TOOLS: WorkspaceToolsConfig = {
  ...TOOL_NAME_OVERRIDES,
  [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
    ...TOOL_NAME_OVERRIDES[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE],
    background: { enabled: true },
  },
  [WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]: {
    ...TOOL_NAME_OVERRIDES[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES],
    background: { enabled: true },
  },
  [WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT]: {
    ...TOOL_NAME_OVERRIDES[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT],
    background: { enabled: true },
  },
  [WORKSPACE_TOOLS.FILESYSTEM.GREP]: {
    ...TOOL_NAME_OVERRIDES[WORKSPACE_TOOLS.FILESYSTEM.GREP],
    background: { enabled: true },
  },
  [WORKSPACE_TOOLS.LSP.LSP_INSPECT]: {
    ...TOOL_NAME_OVERRIDES[WORKSPACE_TOOLS.LSP.LSP_INSPECT],
    background: { enabled: true },
  },
  hooks: {
    beforeToolCall: guardPlanModePlanFileWrites,
  },
};

export const PLAN_MODE_AVAILABLE_TOOLS: readonly string[] = [
  // Read-only exploration tools
  MC_TOOLS.VIEW,
  MC_TOOLS.FIND_FILES,
  MC_TOOLS.SEARCH_CONTENT,
  MC_TOOLS.FILE_STAT,
  MC_TOOLS.LSP_INSPECT,
  // Plan file writing. Tool hooks enforce that these can only write `.md`
  // files inside `.mastracode/plans/` while the session is in plan mode.
  MC_TOOLS.WRITE_FILE,
  MC_TOOLS.STRING_REPLACE_LSP,
  // Plan delivery tools
  'ask_user',
  'submit_plan',
  // Task tools for plan-stage tracking
  'task_write',
  'task_update',
  'task_complete',
  'task_check',
  // Notification access
  MC_TOOLS.NOTIFICATION_INBOX,
];

export const EXPLORE_MODE_AVAILABLE_TOOLS: readonly string[] = [
  MC_TOOLS.VIEW,
  MC_TOOLS.FIND_FILES,
  MC_TOOLS.SEARCH_CONTENT,
  MC_TOOLS.FILE_STAT,
  MC_TOOLS.LSP_INSPECT,
  'ask_user',
];

export const GOAL_JUDGE_READONLY_TOOLS: readonly string[] = [
  MC_TOOLS.VIEW,
  MC_TOOLS.SEARCH_CONTENT,
  MC_TOOLS.FIND_FILES,
  MC_TOOLS.FILE_STAT,
  MC_TOOLS.LSP_INSPECT,
];
