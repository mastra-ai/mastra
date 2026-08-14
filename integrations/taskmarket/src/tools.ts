import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { TaskmarketClientOptions } from './client.js';
import { TaskmarketClient, taskmarketTaskUrl } from './client.js';
import {
  assertBaseNetwork,
  assertSufficientBalance,
  authorizeTaskCreation,
  buildCreatePreview,
  isTaskId,
  isTaskOpen,
  taskStatusLine,
  validateCreateConfig,
} from './create.js';
import type { TaskmarketPreview } from './create.js';

const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'Must be a 0x-prefixed Ethereum address (40 hex characters)');

const taskIdSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'Must be the 0x-prefixed 32-byte task id returned by task creation');

const createInputSchema = z.object({
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(4000, 'Description must be at most 4000 characters')
    .describe('Task description shown to workers. Be specific about the work, deliverables, and acceptance criteria.'),
  rewardUsdc: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,6})?$/, 'USDC amount with at most 6 decimal places')
    .describe('Reward in USDC escrowed on Base Mainnet (e.g. "25" or "25.5").'),
  durationHours: z
    .number()
    .positive()
    .max(24 * 365)
    .describe('Task duration in hours; the submission window closes at deadline.'),
  mode: z
    .enum(['bounty', 'claim', 'pitch', 'benchmark', 'auction'])
    .default('bounty')
    .describe('Task mode: bounty (any worker submits), claim (one worker claims), pitch, benchmark, or auction.'),
  taskVisibility: z
    .enum(['public', 'unlisted', 'private'])
    .default('public')
    .describe('Who can view the task. private requires allowedViewers or an access password.'),
  submissionVisibility: z
    .enum(['public', 'reveal_all', 'winner_only', 'never'])
    .default('public')
    .describe('Who can see submissions after the task ends. Locked in permanently at creation.'),
  maxSpendUsdc: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,6})?$/, 'USDC amount with at most 6 decimal places')
    .describe(
      'Maximum spend you authorize for this task in USDC. The wallet balance must cover it. For the standard bounty flow set it equal to the reward, which is the exact amount escrowed on creation.',
    ),
  tags: z
    .array(z.string())
    .max(10)
    .default([])
    .describe('Comma-separated topic tags (max 10) that help workers find the task.'),
  privateAccessPassword: z
    .string()
    .min(8)
    .optional()
    .describe('Password (min 8 chars) granting anonymous access to a private task. Only valid with taskVisibility private.'),
  allowedViewers: z
    .array(addressSchema)
    .max(20)
    .default([])
    .describe('Wallet addresses invited to view a private task. Only valid with taskVisibility private.'),
  maxPriceUsdc: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,6})?$/, 'USDC amount with at most 6 decimal places')
    .optional()
    .describe('Auction mode only. Must equal rewardUsdc (the escrowed maximum).'),
  auctionType: z
    .enum(['dutch', 'english', 'reverse_dutch', 'reverse_english'])
    .optional()
    .describe('Auction mode only: the auction subtype.'),
  auctionStartPriceUsdc: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,6})?$/, 'USDC amount with at most 6 decimal places')
    .optional()
    .describe('reverse_dutch only: starting clock price, at most the reward.'),
  auctionFloorPriceUsdc: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,6})?$/, 'USDC amount with at most 6 decimal places')
    .optional()
    .describe('dutch only: floor price, at most the reward.'),
  bidDeadlineHours: z
    .number()
    .positive()
    .optional()
    .describe('Auction mode only: bid deadline in hours from now.'),
  pitchDeadlineHours: z
    .number()
    .positive()
    .optional()
    .describe('Pitch mode only: pitch deadline in hours from now.'),
  confirm: z
    .string()
    .describe(
      'Explicit authorization. Pass the exact confirmation code returned by the preview step. This is a fresh code per run; a task is never created without it.',
    ),
});

const createOutputSchema = z.object({
  taskId: z.string(),
  taskUrl: z.string(),
  idempotencyKey: z.string().optional(),
  status: z.string(),
  walletAddress: z.string(),
});

const statusInputSchema = z.object({
  taskId: taskIdSchema.describe('The task id returned by the create task tool.'),
});

const statusOutputSchema = z.object({
  taskId: z.string(),
  taskUrl: z.string(),
  status: z.string(),
  phase: z.string().nullable(),
  rewardBaseUnits: z.string().nullable(),
  netRewardBaseUnits: z.string().nullable(),
  platformFeeBps: z.number().nullable(),
  expiryTime: z.string().nullable(),
  submissionWindowOpen: z.boolean().nullable(),
  submissionCount: z.number(),
  requester: z.string().nullable(),
  raw: z.record(z.string(), z.unknown()),
});

const submissionsInputSchema = z.object({
  taskId: taskIdSchema.describe('The task id returned by the create task tool.'),
});

const submissionEntrySchema = z.object({
  id: z.string(),
  workerAddress: z.string().nullable(),
  workerAgentId: z.string().nullable(),
  submittedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  deliverableHash: z.string().nullable(),
  submitTxHash: z.string().nullable(),
});

const submissionsOutputSchema = z.object({
  taskId: z.string(),
  submissionCount: z.number(),
  submissions: z.array(submissionEntrySchema),
  reviewInstruction: z
    .string()
    .describe(
      'Submissions must be reviewed by a human. This integration never accepts or rejects work automatically.',
    ),
});

function previewBlock(preview: TaskmarketPreview, code: string): string {
  const lines = [
    'Taskmarket task creation requires your explicit authorization. Review the exact task and the money that will move:',
    '',
    `Description : ${preview.description}`,
    `Reward      : ${preview.rewardUsdc} USDC (escrowed on task creation)`,
    `Max spend   : ${preview.maxSpendUsdc} USDC (wallet must cover this; creation escrows the reward)`,
    `Duration    : ${preview.durationHours} hours`,
    `Mode        : ${preview.mode}`,
    `Network     : ${preview.network} (chain id ${preview.chainId}, USDC ${preview.usdcContract})`,
    `Visibility  : task ${preview.taskVisibility}, submissions ${preview.submissionVisibility}`,
  ];
  if (preview.tags.length > 0) {
    lines.push(`Tags        : ${preview.tags.join(', ')}`);
  }
  if (preview.privateAccessPasswordSet) {
    lines.push('Access      : password-protected private task');
  }
  if (preview.allowedViewers.length > 0) {
    lines.push(`Viewers     : ${preview.allowedViewers.join(', ')}`);
  }
  if (preview.auctionType !== undefined) {
    lines.push(`Auction     : ${preview.auctionType}, max price ${preview.maxPriceUsdc} USDC`);
    if (preview.auctionFloorPriceUsdc !== undefined) {
      lines.push(`Floor       : ${preview.auctionFloorPriceUsdc} USDC`);
    }
    if (preview.auctionStartPriceUsdc !== undefined) {
      lines.push(`Start price : ${preview.auctionStartPriceUsdc} USDC`);
    }
  }
  lines.push('', `To create and fund this task, pass confirm: "${code}".`, 'No task is created without this code.');
  return lines.join('\n');
}

/**
 * Creates a TaskmarketClient from shared options, or throws a readable error
 * when the first-party CLI is not installed.
 */
function createClient(config?: TaskmarketClientOptions): TaskmarketClient {
  return new TaskmarketClient(config);
}

/**
 * Creates a Taskmarket task from inside Mastra.
 *
 * Safety contract:
 * - Validates the full configuration locally (no CLI call) before anything else.
 * - Verifies the configured backend is Base Mainnet production before any write.
 * - Verifies the wallet balance covers the authorized max spend.
 * - Requires a fresh confirmation code rendered together with the exact task
 *   preview (description, reward, deadline, deliverables/visibility, Base
 *   network, max spend). A mismatched or missing code aborts the tool.
 * - Delegates wallet signing, legal receipts, and the x402 payment flow to the
 *   first-party `taskmarket` CLI. No keys are requested, stored, or logged.
 */
export function createTaskmarketCreateTaskTool(config?: TaskmarketClientOptions) {
  return createTool({
    id: 'taskmarket-create-task',
    description:
      'Creates a funded Taskmarket task on Base Mainnet as the requester, after showing the exact task (description, reward, deadline, deliverables, Base network, max spend) and requiring an explicit fresh confirmation code. Returns the task id and link. Never call this tool without first rendering the preview and obtaining the confirmation code from the user.',
    inputSchema: createInputSchema,
    outputSchema: createOutputSchema,
    execute: async (input) => {
      const { config: validated, args } = validateCreateConfig(input);
      const preview = buildCreatePreview(validated);

      // Authorization gate: the confirmation code is bound to this exact task.
      // A missing, stale, or mismatched code aborts before any CLI call.
      authorizeTaskCreation(preview, input.confirm, preview.confirmationCode);

      const client = createClient(config);

      // Network guard: refuse anything that is not production Base.
      await assertBaseNetwork(client);

      // Spending guard: wallet must cover the authorized max spend.
      const { address: walletAddress } = await assertSufficientBalance(client, preview.maxSpendUsdc);

      const { taskId, idempotencyKey } = await client.createTask(args);

      let status = 'created';
      try {
        const task = await client.getTask(taskId);
        status = taskStatusLine(task);
      } catch {
        // The task id is the source of truth; status refresh is best-effort.
      }

      return {
        taskId,
        taskUrl: taskmarketTaskUrl(taskId),
        idempotencyKey,
        status,
        walletAddress,
      };
    },
  });
}

/**
 * Reads the live status of a Taskmarket task by id. Read-only: no payments,
 * no state changes.
 */
export function createTaskmarketTaskStatusTool(config?: TaskmarketClientOptions) {
  return createTool({
    id: 'taskmarket-task-status',
    description:
      'Returns the live status of a Taskmarket task by id: status, phase, reward, platform fee, expiry, and submission count. Read-only; costs nothing.',
    inputSchema: statusInputSchema,
    outputSchema: statusOutputSchema,
    execute: async ({ taskId }) => {
      const client = createClient(config);
      const task = await client.getTask(taskId);

      return {
        taskId: task.id,
        taskUrl: taskmarketTaskUrl(task.id),
        status: task.status ?? 'unknown',
        phase: task.phase ?? null,
        rewardBaseUnits: task.reward ?? null,
        netRewardBaseUnits: task.netReward ?? null,
        platformFeeBps: task.platformFeeBps ?? null,
        expiryTime: task.expiryTime ?? null,
        submissionWindowOpen: task.submissionWindowOpen ?? null,
        submissionCount: task.submissionCount ?? 0,
        requester: task.requester ?? null,
        raw: task as Record<string, unknown>,
      };
    },
  });
}

/**
 * Lists the submissions of a Taskmarket task for human review. Read-only, and
 * deliberately the end of the line: the integration never accepts or rejects
 * submissions automatically.
 */
export function createTaskmarketSubmissionsTool(config?: TaskmarketClientOptions) {
  return createTool({
    id: 'taskmarket-submissions',
    description:
      'Lists the submissions of a Taskmarket task (worker, submittedAt, deliverable hash, tx hash) for human review. Read-only. Submissions are never accepted or rejected automatically; a human decides.',
    inputSchema: submissionsInputSchema,
    outputSchema: submissionsOutputSchema,
    execute: async ({ taskId }) => {
      const client = createClient(config);
      const submissions = await client.submissions(taskId);

      return {
        taskId,
        submissionCount: submissions.length,
        submissions: submissions.map(submission => ({
          id: submission.id,
          workerAddress: submission.workerAddress ?? null,
          workerAgentId: submission.workerAgentId ?? null,
          submittedAt: submission.submittedAt ?? null,
          rejectedAt: submission.rejectedAt ?? null,
          deliverableHash: submission.deliverableHash ?? null,
          submitTxHash: submission.submitTxHash ?? null,
        })),
        reviewInstruction:
          'Review these submissions with a human before deciding anything. This integration never accepts or rejects work automatically.',
      };
    },
  });
}

/**
 * Convenience factory returning all Taskmarket tools sharing one configuration.
 */
export function createTaskmarketTools(config?: TaskmarketClientOptions) {
  return {
    createTask: createTaskmarketCreateTaskTool(config),
    taskStatus: createTaskmarketTaskStatusTool(config),
    submissions: createTaskmarketSubmissionsTool(config),
  };
}

export { createTaskmarketCreateTaskTool as createTaskmarketCreateTool };

export type { TaskmarketClientOptions };
export { TaskmarketClient } from './client.js';

export { isTaskId, isTaskOpen };
