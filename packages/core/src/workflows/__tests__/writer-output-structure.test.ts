import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import type { ChunkType } from '../../stream/types';
import { createStep, createWorkflow } from '../workflow';

const testStorage = new MockStore();

describe('writer.write() output structure - Issue #12190', () => {
  it('should deliver writer.write() data directly as the chunk to the stream consumer, not wrapped in an envelope', async () => {
    // The user writes a simple object via writer.write()
    const userPayload = { message: 'hello', count: 42 };

    const testStep = createStep({
      id: 'testStep',
      description: 'Step that uses writer.write()',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ done: z.boolean() }),
      execute: async ({ writer }) => {
        // User calls writer.write() expecting the consumer to receive `userPayload`
        await writer.write(userPayload);
        return { done: true };
      },
    });

    const workflow = createWorkflow({
      id: 'test-writer-output',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ done: z.boolean() }),
      steps: [testStep],
    });

    workflow.then(testStep).commit();

    new Mastra({
      logger: false,
      storage: testStorage,
      workflows: { 'test-writer-output': workflow },
    });

    const run = await workflow.createRun();
    const stream = run.stream({ inputData: { input: 'test' } });

    const allChunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      allChunks.push(chunk);
    }

    // Find the workflow-step-output chunk
    const stepOutputChunks = allChunks.filter(c => c.type === 'workflow-step-output');
    expect(stepOutputChunks.length).toBe(1);

    const stepOutput = stepOutputChunks[0]!;
    expect(stepOutput.type).toBe('workflow-step-output');

    // The actual runtime payload structure.
    // ToolStream._write() wraps the user data in an envelope:
    //   { output: userPayload, runId: string, stepName: string }
    //
    // The StepOutputPayload type says:
    //   { output: ChunkType | NestedWorkflowOutput; [key: string]: unknown }
    //
    // This test proves the mismatch:
    // 1. payload.output is the user's raw data, NOT a ChunkType or NestedWorkflowOutput
    // 2. payload contains runId and stepName fields not declared in the type

    const payload = (stepOutput as any).payload;

    // Verify the envelope wrapping exists (this is the current behavior)
    expect(payload).toHaveProperty('output');
    expect(payload).toHaveProperty('runId');
    expect(payload).toHaveProperty('stepName');
    expect(payload.stepName).toBe('testStep');

    // The user's data is nested inside payload.output
    expect(payload.output).toEqual(userPayload);

    // BUG: The type StepOutputPayload says output should be ChunkType | NestedWorkflowOutput,
    // but the user's raw data ({ message: 'hello', count: 42 }) is neither.
    // A ChunkType always has { type: string, runId: string, from: string } at minimum.
    // The user's data doesn't have these fields, proving the type is wrong.
    expect(payload.output).not.toHaveProperty('runId');
    expect(payload.output).not.toHaveProperty('from');

    // BUG: The StepOutputPayload type doesn't include runId or stepName as named fields,
    // they only exist via [key: string]: unknown, which provides no type safety.
    // These fields are always present for workflow-step-output chunks but aren't typed.
    expect(typeof payload.runId).toBe('string');
    expect(typeof payload.stepName).toBe('string');
  });

  it('should have consistent payload type for workflow-step-output between type definition and runtime', async () => {
    // This test verifies the specific structure documented in the issue:
    // The user reported receiving:
    //   { from: string, payload: { output: any, runId: string, stepName: string }, runId: string, type: string }

    const testStep = createStep({
      id: 'reportedStep',
      description: 'Step matching the issue report',
      inputSchema: z.object({ data: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ({ writer }) => {
        await writer.write({ status: 'processing', progress: 50 });
        return { result: 'done' };
      },
    });

    const workflow = createWorkflow({
      id: 'test-reported-structure',
      inputSchema: z.object({ data: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [testStep],
    });

    workflow.then(testStep).commit();

    new Mastra({
      logger: false,
      storage: testStorage,
      workflows: { 'test-reported-structure': workflow },
    });

    const run = await workflow.createRun();
    const stream = run.stream({ inputData: { data: 'test' } });

    const allChunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      allChunks.push(chunk);
    }

    const stepOutputChunk = allChunks.find(c => c.type === 'workflow-step-output');
    expect(stepOutputChunk).toBeDefined();

    // Verify the full structure matches what the issue reporter documented
    const chunk = stepOutputChunk as any;
    expect(chunk).toMatchObject({
      from: expect.any(String), // 'USER'
      type: 'workflow-step-output',
      runId: expect.any(String),
      payload: {
        output: { status: 'processing', progress: 50 },
        runId: expect.any(String),
        stepName: 'reportedStep',
      },
    });

    // The from field should be 'USER' since ToolStream sets it
    expect(chunk.from).toBe('USER');

    // Demonstrate that the OutputWriter type (chunk: TChunk) => Promise<void>
    // is misleading - the callback doesn't receive TChunk directly,
    // it receives the wrapped envelope. The OutputWriter type should either:
    // 1. Reflect the wrapped structure, or
    // 2. The runtime should deliver the raw chunk without wrapping
  });

  it('StepOutputPayload.output should include runId and stepName fields for workflow-step-output chunks', async () => {
    // The StepOutputPayload type definition is:
    //   { output: ChunkType | NestedWorkflowOutput; [key: string]: unknown }
    //
    // But the actual runtime payload for writer.write() in a workflow step includes
    // runId and stepName as sibling fields to output. These should be typed explicitly,
    // not hidden behind [key: string]: unknown.

    const testStep = createStep({
      id: 'typedStep',
      description: 'Step to test typed payload',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async ({ writer }) => {
        await writer.write({ data: 'test' });
        return { ok: true };
      },
    });

    const workflow = createWorkflow({
      id: 'test-typed-payload',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      steps: [testStep],
    });

    workflow.then(testStep).commit();

    new Mastra({
      logger: false,
      storage: testStorage,
      workflows: { 'test-typed-payload': workflow },
    });

    const run = await workflow.createRun();
    const stream = run.stream({ inputData: { input: 'test' } });

    const allChunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      allChunks.push(chunk);
    }

    const stepOutputChunk = allChunks.find(c => c.type === 'workflow-step-output');
    expect(stepOutputChunk).toBeDefined();

    // BUG (FAILING ASSERTION): When accessing payload on a workflow-step-output chunk
    // via the TypeScript type, `payload.stepName` and `payload.runId` should be
    // strongly typed string fields, not hidden behind `[key: string]: unknown`.
    //
    // This assertion proves the type mismatch: if we try to access these fields
    // through the typed interface, TypeScript doesn't know they exist.
    // The fix should add `stepName: string` and `runId: string` to StepOutputPayload,
    // or create a dedicated WorkflowStepOutputPayload type.
    if (stepOutputChunk && stepOutputChunk.type === 'workflow-step-output') {
      // These fields exist at runtime but are not in the StepOutputPayload type.
      // After the fix, these should be accessible without casting to `any`.
      const payload = stepOutputChunk.payload;

      // Currently payload is typed as StepOutputPayload which only has:
      //   output: ChunkType | NestedWorkflowOutput
      //   [key: string]: unknown
      //
      // The following accesses require `any` cast because the fields aren't typed.
      // After the fix, they should be directly accessible on the type.
      const runId = (payload as any).runId;
      const stepName = (payload as any).stepName;

      expect(runId).toBeDefined();
      expect(typeof runId).toBe('string');
      expect(stepName).toBe('typedStep');

      // FAILING TYPE CHECK: The output field should accept arbitrary user data,
      // not just ChunkType | NestedWorkflowOutput.
      // When a user calls writer.write({ data: 'test' }), the output is { data: 'test' },
      // which is NOT a ChunkType (no runId, from, type fields required by BaseChunkType).
      const output = payload.output;
      // This assertion will fail because the type says output should be ChunkType | NestedWorkflowOutput
      // but the actual value is { data: 'test' } which doesn't conform to either type.
      // ChunkType requires: { runId: string, from: ChunkFrom, type: string, ... }
      // The user's data has none of those fields.
      expect(output).toEqual({ data: 'test' });

      // Prove the output is NOT a valid ChunkType by checking it lacks required fields
      expect(output).not.toHaveProperty('runId');
      expect(output).not.toHaveProperty('from');
    }
  });
});
