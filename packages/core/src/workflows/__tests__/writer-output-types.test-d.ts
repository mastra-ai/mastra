/**
 * Type-level tests for issue #12190: OutputWriter chunk type mismatch.
 *
 * These tests verify that the TypeScript types for workflow-step-output chunks
 * correctly reflect the runtime data structure produced by ToolStream._write().
 *
 * Currently, StepOutputPayload defines:
 *   { output: ChunkType | NestedWorkflowOutput; [key: string]: unknown }
 *
 * But the actual runtime payload from writer.write(userdata) is:
 *   { output: <user's arbitrary data>, runId: string, stepName: string }
 *
 * Two problems:
 * 1. output is typed as ChunkType | NestedWorkflowOutput but user data
 *    (arbitrary objects) doesn't conform to either type.
 * 2. runId and stepName always exist at runtime for workflow-step-output
 *    but aren't declared fields — they're hidden behind [key: string]: unknown.
 */
import { assertType, describe, expectTypeOf, it } from 'vitest';
import type { WorkflowStreamEvent } from '../../stream/types';

// Extract the workflow-step-output chunk type from WorkflowStreamEvent
type WorkflowStepOutputChunk = Extract<WorkflowStreamEvent, { type: 'workflow-step-output' }>;
type WorkflowStepOutputPayload = WorkflowStepOutputChunk['payload'];

describe('Issue #12190: OutputWriter chunk type mismatch', () => {
  describe('workflow-step-output payload should have explicit stepName and runId fields', () => {
    it('payload.stepName should be typed as string, not unknown', () => {
      // ToolStream._write() always sets stepName for workflow-step prefix.
      // The type should declare this field explicitly so consumers don't need `as any`.
      //
      // Currently StepOutputPayload has [key: string]: unknown, so
      // payload['stepName'] resolves to `unknown` — not `string`.
      //
      // EXPECTED TO FAIL: After fix, remove @ts-expect-error and this should pass.
      // @ts-expect-error — stepName resolves to unknown via index signature, not string
      expectTypeOf<WorkflowStepOutputPayload['stepName']>().toBeString();
    });

    it('payload.runId should be typed as string, not unknown', () => {
      // ToolStream._write() always sets runId for workflow-step prefix.
      //
      // EXPECTED TO FAIL: After fix, remove @ts-expect-error and this should pass.
      // @ts-expect-error — runId resolves to unknown via index signature, not string
      expectTypeOf<WorkflowStepOutputPayload['runId']>().toBeString();
    });
  });

  describe('workflow-step-output payload.output should accept user data from writer.write()', () => {
    it('arbitrary user data should be assignable to the output field type', () => {
      // When a user calls writer.write({ message: 'hello', count: 42 }) in a step,
      // the output field in the workflow-step-output chunk payload holds that data.
      //
      // Currently output is typed as ChunkType | NestedWorkflowOutput.
      // ChunkType requires { runId: string, from: ChunkFrom, type: string, ... }
      // and NestedWorkflowOutput requires { from: ChunkFrom, type: string, ... }.
      // User data like { message: string, count: number } has none of those fields.
      //
      // The fix should widen output to also accept arbitrary user data,
      // e.g. ChunkType | NestedWorkflowOutput | unknown, or use a discriminated
      // union with a separate WorkflowStepOutputPayload that has output: unknown.
      type UserData = { message: string; count: number };
      type OutputType = WorkflowStepOutputPayload['output'];

      // FAILS: UserData is not assignable to ChunkType | NestedWorkflowOutput
      assertType<OutputType>({ message: 'hello', count: 42 } as UserData);
    });
  });
});
