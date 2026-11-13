import { createStep, createWorkflow } from '@mastra/core/workflows';
import { BillingError } from '../../billing/contracts.js';
import type { ResourceDependencies } from '../../billing/resource-catalog.js';
import {
  kitInputSchema,
  kitStateSchema,
  kitOutputSchema,
  approvalSchema,
  imageOutputSchema,
} from '../../images/schemas.js';

export function createImageKit(dependencies: ResourceDependencies) {
  const prepare = createStep({
    id: 'prepare',
    inputSchema: kitInputSchema,
    outputSchema: kitStateSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      prompts: [
        `${inputData.brief}\nIllustration for books and websites. Preserve the brief's subject and content; no additional scenes. Notion-inspired style: minimal black-and-white hand-drawn line art on a light background.`,
        `${inputData.brief}\nIllustration for books and websites. Preserve the brief's subject and content; no additional scenes. 3D style: visible volume and soft lighting.`,
        `${inputData.brief}\nIllustration for books and websites. Preserve the brief's subject and content; no additional scenes. Vector illustration style: flat shapes and crisp edges. Render as PNG.`,
      ] as [string, string, string],
    }),
  });
  const approval = createStep({
    id: 'approval',
    inputSchema: kitStateSchema,
    outputSchema: kitStateSchema,
    resumeSchema: approvalSchema,
    suspendSchema: kitStateSchema,
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) return suspend(inputData);
      if (!resumeData.approved) throw new BillingError('conflict');
      return inputData;
    },
  });
  const generate = createStep({
    id: 'generate',
    inputSchema: kitStateSchema,
    outputSchema: kitOutputSchema,
    execute: async ({ inputData }) => {
      const artifacts = [];
      for (let slot = 0; slot < 3; slot++) {
        const result = await dependencies.nestedAgent('image-agent').generate(inputData.prompts[slot], slot);
        artifacts.push(imageOutputSchema.parse(result.object).artifacts[0]);
      }
      return kitOutputSchema.parse({ ...inputData, artifacts });
    },
  });
  return createWorkflow({
    id: 'image-kit',
    inputSchema: kitInputSchema,
    outputSchema: kitOutputSchema,
    steps: [prepare, approval, generate],
    options: { autoRestartActiveRuns: false },
  })
    .then(prepare)
    .then(approval)
    .then(generate)
    .commit();
}
