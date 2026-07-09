import os from 'node:os';
import path from 'node:path';
// Relative import across examples (same pattern the preview agent uses for MODEL_TOKENS);
// keeps a single source for the writer tool while this file only adds the Vercel behavior.
import { createWritePlanFileTool } from '../../../../agent/src/mastra/tools/plan-file-tool';

const resolveProjectRoot = () => {
  if (!process.env.MASTRA_SUBMIT_PLAN_PROJECT_ROOT && process.env.VERCEL) {
    process.env.MASTRA_SUBMIT_PLAN_PROJECT_ROOT = path.join(os.tmpdir(), 'mastra-studio-preview');
  }

  return path.resolve(process.env.MASTRA_SUBMIT_PLAN_PROJECT_ROOT ?? process.env.MASTRA_PROJECT_ROOT ?? process.cwd());
};

// Initialize the writable root during module load so the plan file is written to the same
// location the built-in submit_plan tool reads from.
resolveProjectRoot();

export const writePlanFileTool = createWritePlanFileTool({
  resolveProjectRoot,
  filenameExample: 'preview-plan.md',
});
