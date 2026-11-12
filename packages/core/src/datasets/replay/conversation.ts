import { z } from 'zod/v4';
import type { TrajectoryExpectation } from '../../evals/types';
import type { DataItem } from '../experiment/types';
import type { ReplayMessage } from './from-thread';

/** A recorded user turn and its grading references. References never enter candidate history. */
export type ConversationReplayTurn = Pick<
  DataItem<ReplayMessage[], string>,
  'input' | 'groundTruth' | 'expectedTrajectory' | 'toolMocks'
>;

export interface ConversationReplayInput {
  type: 'conversation';
  turns: ConversationReplayTurn[];
}

// User messages retain attachments and data parts, but cannot smuggle original
// assistant/tool messages or production memory identities into the candidate.
const userMessageSchema = z
  .object({
    role: z.literal('user'),
    createdAt: z.iso.datetime(),
    type: z.string().optional(),
    content: z
      .object({
        format: z.literal(2),
        parts: z.array(
          z.union([
            z.object({ type: z.literal('text'), text: z.string() }).passthrough(),
            z.object({ type: z.literal('file'), mimeType: z.string(), data: z.string() }).passthrough(),
            z.object({ type: z.string().startsWith('data-'), data: z.unknown() }).passthrough(),
          ]),
        ),
        experimental_attachments: z
          .array(
            z
              .object({
                url: z.string(),
                contentType: z.string().optional(),
                name: z.string().optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough(),
    id: z.never().optional(),
    threadId: z.never().optional(),
    resourceId: z.never().optional(),
  })
  .passthrough();

const toolMockSchema = z
  .object({
    toolName: z.string().min(1),
    args: z.record(z.string(), z.unknown()),
    output: z.unknown(),
    matchArgs: z.enum(['strict', 'ignore']).optional(),
  })
  .refine(mock => Object.hasOwn(mock, 'output'), { path: ['output'], message: 'A recorded tool output is required.' });

// Expectations retain the existing open trajectory contract (including nested
// steps). The executor never interprets them; existing scorers do.
const expectationSchema: z.ZodType<TrajectoryExpectation> = z
  .object({
    steps: z.array(z.object({ name: z.string() }).passthrough()).optional(),
    ordering: z.enum(['strict', 'relaxed', 'unordered']).optional(),
  })
  .passthrough();

const conversationInputSchema = z
  .object({
    type: z.literal('conversation'),
    turns: z
      .array(
        z
          .object({
            input: z
              .array(
                z.custom<ReplayMessage>(
                  value => userMessageSchema.safeParse(value).success,
                  'Expected a recorded user message without source identities.',
                ),
              )
              .min(1),
            groundTruth: z.string().optional(),
            expectedTrajectory: expectationSchema.optional(),
            toolMocks: z.array(toolMockSchema).optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

// Storage represents absent optional fields as null. Accept that representation,
// but reject duplicate top-level references rather than giving them precedence.
export const conversationItemSchema = z.object({
  input: conversationInputSchema,
  toolMocks: z.null().optional(),
  groundTruth: z.null().optional(),
  expectedTrajectory: z.null().optional(),
  toolMockMatchMode: z.literal('lookup').nullish(),
  unmockedToolPolicy: z.literal('deny').nullish(),
});

export function isConversationInput(input: unknown): input is { type: 'conversation' } {
  return typeof input === 'object' && input !== null && 'type' in input && input.type === 'conversation';
}
