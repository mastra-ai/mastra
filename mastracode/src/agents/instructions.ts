import type { HarnessRequestContext } from '@mastra/core/harness';
import type { MastraCodeComposedState } from '../schema.js';
import { detectCommonBinariesAsync } from '../utils/binaries.js';
import { getCurrentGitBranchAsync } from '../utils/project.js';
import type { PromptContext } from './prompts/index.js';
import { buildFullPrompt } from './prompts/index.js';

export async function getDynamicInstructions({ requestContext }: { requestContext: { get(key: string): unknown } }) {
  const harnessContext = requestContext.get('harness') as HarnessRequestContext<MastraCodeComposedState> | undefined;
  const state = harnessContext?.session.state.get();
  const modeId = harnessContext?.session?.modeId ?? 'build';
  const projectPath = state?.projectPath ?? process.cwd();

  // Resolve the real thread id so mode prompts (e.g. plan mode) can render the
  // exact thread-scoped working plan path the agent must use. The real
  // HarnessRequestContext exposes threadId at the top level (not session.thread).
  const threadId = harnessContext?.threadId ?? state?.threadId;
  const stateWithThreadId =
    typeof threadId === 'string' && threadId.length > 0 ? { ...(state ?? {}), threadId } : state;

  const promptCtx: PromptContext = {
    projectPath,
    projectName: state?.projectName ?? '',
    gitBranch: (await getCurrentGitBranchAsync(projectPath)) ?? state?.gitBranch,
    platform: process.platform,
    commonBinaries: await detectCommonBinariesAsync(),
    date: new Date().toISOString().split('T')[0]!,
    mode: modeId,
    modelId: harnessContext?.session?.modelId || undefined,
    activePlan: state?.activePlan ?? null,
    modeId: modeId,
    currentDate: new Date().toISOString().split('T')[0]!,
    workingDir: state?.projectPath ?? process.cwd(),
    state: stateWithThreadId,
  };

  return buildFullPrompt(promptCtx);
}
