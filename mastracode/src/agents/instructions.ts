import type { HarnessRequestContext } from '@mastra/core/harness';
import type { MastraCodeComposedState } from '../schema.js';
import { detectCommonBinariesAsync } from '../utils/binaries.js';
import { getCurrentGitBranchAsync } from '../utils/project.js';
import type { PromptContext } from './prompts/index.js';
import { buildFullPrompt } from './prompts/index.js';

export async function getDynamicInstructions({ requestContext }: { requestContext: { get(key: string): unknown } }) {
  const harnessContext = requestContext.get('harness') as HarnessRequestContext<MastraCodeComposedState> | undefined;
  const state = harnessContext?.getState?.();
  const modeId = harnessContext?.modeId ?? 'build';
  const projectPath = state?.projectPath ?? process.cwd();
  // V1 harness context exposes `modelId` directly; legacy uses `state.currentModelId`
  const currentModelId = (harnessContext as any)?.modelId ?? state?.currentModelId;

  const promptCtx: PromptContext = {
    projectPath,
    projectName: state?.projectName ?? '',
    gitBranch: (await getCurrentGitBranchAsync(projectPath)) ?? state?.gitBranch,
    platform: process.platform,
    commonBinaries: await detectCommonBinariesAsync(),
    date: new Date().toISOString().split('T')[0]!,
    mode: modeId,
    modelId: currentModelId || undefined,
    activePlan: state?.activePlan ?? null,
    modeId: modeId,
    currentDate: new Date().toISOString().split('T')[0]!,
    workingDir: state?.projectPath ?? process.cwd(),
    state: state,
  };

  return buildFullPrompt(promptCtx);
}
