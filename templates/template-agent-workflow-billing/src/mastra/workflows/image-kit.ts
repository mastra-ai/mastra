import type { Artifact } from '../../images/schemas.js';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import {
  kitInputSchema,
  kitStateSchema,
  kitOutputSchema,
  approvalSchema,
  imageOutputSchema,
} from '../../images/schemas.js';

/** Execution dependency supplied by the application, independent of billing and storage. */
export interface ImageKitDependencies {
  /** Resolve the image agent and generate a result for one style in the kit. */
  nestedAgent(id: string): {
    generate(prompt: string, slot?: number): Promise<{ object?: unknown }>;
  };
}

export function createImageKit(dependencies: ImageKitDependencies) {
  const prepare = createStep({
    id: 'prepare',
    inputSchema: kitInputSchema,
    outputSchema: kitStateSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      prompts: [
        `ONE illustration. Notion-inspired style: minimal black-and-white hand-drawn line art on light background. No text/collage/panels. Ignore styles/variants in <subject>.\n<subject>${inputData.brief}</subject>`,
        `ONE illustration. 3D style: visible volume and soft lighting. No text/collage/panels. Ignore styles/variants in <subject>.\n<subject>${inputData.brief}</subject>`,
        `ONE illustration. Vector illustration style: flat shapes and crisp edges. No text/collage/panels. Ignore styles/variants in <subject>.\n<subject>${inputData.brief}</subject>`,
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
      return inputData;
    },
  });
  const generate = createStep({
    id: 'generate',
    inputSchema: kitStateSchema,
    outputSchema: kitOutputSchema,
    execute: async ({ inputData }) => {
      const generateImage = async (slot: number) => {
        const result = await dependencies.nestedAgent('image-agent').generate(inputData.prompts[slot], slot);
        return imageOutputSchema.parse(result.object).artifacts[0];
      };
      const artifacts: [Artifact, Artifact, Artifact] = [
        await generateImage(0),
        await generateImage(1),
        await generateImage(2),
      ];
      return { ...inputData, artifacts };
    },
  });
  const workflow = createWorkflow({
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
  workflow.name = 'Image Kit';
  return workflow;
}
