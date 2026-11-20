import type { ExecutionScope } from '../billing/runtime/execution-scope.js';
import { z } from 'zod';
import { resourceAction } from '../billing/resource-catalog.js';
import { identifierSchema } from '../billing/contracts/core.js';
import { imageOutputSchema, briefSchema, kitInputSchema, approvalSchema } from './schemas.js';
import type { ImageService } from './service.js';

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
export function imageAdapters(images: ImageService) {
  return [
    {
      adapter: {
        version: 'image-agent-v1',
        maxSteps: 2,
        maxOutputTokens: 200,
        promptSchema: briefSchema,
        artifactSlots: 1,
        outputSchema: imageOutputSchema,
        completion: async (scope: ExecutionScope) => ({
          text: 'Image generated.',
          finishReason: 'stop',
          object: { artifacts: [await images.completed(scope)] },
        }),
      },
      actions: actions.slice(0, 1),
    },
    {
      agentDependencies: ['image-agent'],
      adapter: {
        version: 'image-kit-v2',
        measurement: 'facade-calls',
        expectedCalls: [0, 3],
        artifactSlots: 3,
        completion: (scope: ExecutionScope, output: unknown) => images.completeKit(scope, output),
      },
      actions: actions.slice(1),
    },
  ] as const;
}
