import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { resourceAction } from '../billing/resource-catalog.js';
import type { ResourceDefinition, ResourceDependencies } from '../billing/resource-catalog.js';
import { BillingError, identifierSchema } from '../billing/contracts.js';
import {
  imageOutputSchema,
  briefSchema,
  kitInputSchema,
  kitStateSchema,
  kitOutputSchema,
  approvalSchema,
} from './schemas.js';
import { ImageService } from './service.js';

function createImageAgent(environment: NodeJS.ProcessEnv, images: ImageService) {
  return new Agent({
    id: 'image-agent',
    name: 'Image Agent',
    instructions:
      'Generate the requested image using the generateImage tool exactly once. The tool uses the approved server-owned brief and fixed image profile. Do not invent artifacts, paths or URLs. After the tool succeeds, give a short confirmation.',
    model: {
      id: 'openai/gpt-6-luna',
      api: 'responses',
      url: environment.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      apiKey: environment.OPENAI_API_KEY,
    },
    maxRetries: 0,
    defaultOptions: { providerOptions: { openai: { reasoningEffort: 'none' } } },
    tools: {
      generateImage: createTool({
        id: 'generateImage',
        description: 'Generate the one image assigned to this execution slot.',
        inputSchema: z.strictObject({}),
        outputSchema: imageOutputSchema,
        execute: async () => imageOutputSchema.parse({ artifacts: [await images.generate()] }),
      }),
    },
  });
}
function createImageKit(dependencies: ResourceDependencies) {
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
const selection = z.strictObject({ workspaceId: identifierSchema });
const operation = selection.extend({ idempotencyKey: identifierSchema });
const run = selection.extend({ executionId: identifierSchema });
const actions = [
  resourceAction({
    id: 'billing-image-generate',
    description: 'Generate one private image for one credit. Reuse the same key and brief for a saved replay.',
    inputSchema: operation.extend({ brief: briefSchema }),
    execute: async (input, { execution, selected }) =>
      execution.generate('image-agent', input.brief, await selected(input.workspaceId), input.idempotencyKey),
  }),
  resourceAction({
    id: 'billing-image-kit-start',
    description:
      'Reserve three credits, prepare Notion-inspired, 3D and vector illustration prompts for the same subject and wait for approval without generating images.',
    inputSchema: operation.extend({ brief: kitInputSchema.shape.brief }),
    execute: async (input, { execution, selected }) => {
      const billing = await selected(input.workspaceId);
      const { executionId } = await execution.createRun('image-kit', billing, input.idempotencyKey);
      return execution.workflowOperation('image-kit', executionId, 'start', billing, input.idempotencyKey, {
        brief: input.brief,
      });
    },
  }),
  resourceAction({
    id: 'billing-image-kit-status',
    description: 'Read your saved image-kit status and receipt.',
    inputSchema: run,
    execute: async (input, { execution, selected }) =>
      execution.workflowOperation(
        'image-kit',
        input.executionId,
        'status',
        await selected(input.workspaceId),
        undefined,
        null,
      ),
  }),
  resourceAction({
    id: 'billing-image-kit-approve',
    description: 'Approve or reject the saved prompts. Only full success confirms three credits.',
    inputSchema: run.extend({ idempotencyKey: identifierSchema, approval: approvalSchema }),
    execute: async (input, { execution, selected }) =>
      execution.workflowOperation(
        'image-kit',
        input.executionId,
        'resume',
        await selected(input.workspaceId),
        input.idempotencyKey,
        { step: 'approval', resumeData: input.approval },
      ),
  }),
  resourceAction({
    id: 'billing-image-kit-cancel',
    description: 'Cancel a suspended image kit and release its reservation.',
    inputSchema: run.extend({ idempotencyKey: identifierSchema }),
    execute: async (input, { execution, selected }) =>
      execution.workflowOperation(
        'image-kit',
        input.executionId,
        'cancel',
        await selected(input.workspaceId),
        input.idempotencyKey,
        {},
      ),
  }),
];
export function imageDefinitions(environment: NodeJS.ProcessEnv, images: ImageService) {
  return [
    {
      id: 'image-agent',
      kind: 'agent',
      create: () => createImageAgent(environment, images),
      adapter: {
        version: 'image-agent-v1',
        maxSteps: 2,
        maxOutputTokens: 200,
        promptSchema: briefSchema,
        artifactSlots: 1,
        outputSchema: imageOutputSchema,
        completion: async scope => ({
          text: 'Image generated.',
          finishReason: 'stop',
          object: { artifacts: [await images.completed(scope)] },
        }),
      },
      operations: ['generate'],
      measurements: [],
      policy: { version: 'image-agent-v1', charge: { type: 'credits', meter: 'image-credits', units: 1 } },
      actions: actions.slice(0, 1),
    },
    {
      id: 'image-kit',
      kind: 'workflow',
      create: createImageKit,
      agentDependencies: ['image-agent'],
      adapter: {
        version: 'image-kit-v2',
        measurement: 'facade-calls',
        expectedCalls: [0, 3],
        artifactSlots: 3,
        completion: (scope, output) => images.completeKit(scope, output),
      },
      operations: ['start', 'resume', 'cancel'],
      measurements: [],
      policy: {
        version: 'image-kit-v2',
        suspendedReservationTtlMs: 1800000,
        charge: { type: 'credits', meter: 'image-credits', units: 3 },
      },
      actions: actions.slice(1),
    },
  ] as const satisfies readonly ResourceDefinition[];
}
