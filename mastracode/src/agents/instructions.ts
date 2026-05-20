import type { HarnessRequestContext } from '@mastra/core/harness';
import type { z } from 'zod';
import type { stateSchema } from '../schema.js';
import { detectCommonBinaries } from '../utils/binaries.js';
import { detectNestedGitTrees, getCurrentGitBranch } from '../utils/project.js';
import type { PromptContext } from './prompts/index.js';
import { buildFullPrompt } from './prompts/index.js';

type MastraCodeState = z.infer<typeof stateSchema>;

export function getDynamicInstructions({ requestContext }: { requestContext: { get(key: string): unknown } }) {
  const harnessContext = requestContext.get('harness') as HarnessRequestContext<MastraCodeState> | undefined;
  const state = harnessContext?.state;
  const modeId = harnessContext?.modeId ?? 'build';
  const projectPath = state?.projectPath ?? process.cwd();

  // Re-detect nested git trees on every prompt build so newly-created
  // worktrees / submodules are picked up without restarting the session.
  const nestedGitTrees = detectNestedGitTrees(projectPath).map(t => ({
    relativePath: t.relativePath,
    description: t.description,
  }));

  const promptCtx: PromptContext = {
    projectPath,
    projectName: state?.projectName ?? '',
    gitBranch: getCurrentGitBranch(projectPath) ?? state?.gitBranch,
    platform: process.platform,
    commonBinaries: detectCommonBinaries(),
    date: new Date().toISOString().split('T')[0]!,
    mode: modeId,
    modelId: state?.currentModelId || undefined,
    activePlan: state?.activePlan ?? null,
    modeId: modeId,
    currentDate: new Date().toISOString().split('T')[0]!,
    workingDir: state?.projectPath ?? process.cwd(),
    state: state,
    nestedGitTrees,
  };

  return buildFullPrompt(promptCtx);
}
