import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import type { MastraModelOutput } from '../../../../stream/base/output';
import type { ChunkType } from '../../../../stream/types';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Regression class: `getFullOutput().text` of a run that suspends after a completed step (#28346).
 *
 * The run completes a tool step, streams text in a later step, and that step's tool call waits
 * for approval. The later step never finishes, so its text is in no step result. `output.text`
 * holds it; `getFullOutput().text` must hold the same text, exactly once, on the first suspension
 * and when a resumed run completes another step and suspends again.
 */
describeForAllEngines('AIMock loop scenario: full output text of a run suspended after a completed step', engine => {
  const getMock = useLoopScenarioAimock();

  type RunHandle = { output?: MastraModelOutput<unknown>; fullStream: AsyncIterable<ChunkType> };
  const outputOf = (run: RunHandle) => (run.output ?? run) as MastraModelOutput<unknown>;

  /** Drains a segment up to its approval and returns the pending tool call id. */
  async function drainToApproval(run: RunHandle) {
    let toolCallId: string | undefined;
    for await (const chunk of run.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = (chunk.payload as { toolCallId: string }).toolCallId;
        // Durable streams can stay open across a suspension; stop at the approval.
        if (isDurableEngineVariant(engine)) break;
      }
    }
    return toolCallId;
  }

  async function suspendAfterCompletedStep() {
    const lookupFile = createTool({
      id: 'lookup_file',
      description: 'Look up a file.',
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => ({ path, size: 42 }),
    });
    const deleteFile = createTool({
      id: 'delete_file',
      description: 'Delete a file.',
      inputSchema: z.object({ path: z.string() }),
      requireApproval: true,
      execute: async ({ path }) => ({ path, deleted: true }),
    });

    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        content: 'Checking the file. ',
        toolCalls: [{ id: 'call_lookup_1', name: 'lookup_file', arguments: { path: 'a.txt' } }],
      },
    );
    llm.on(
      { endpoint: 'chat', toolCallId: 'call_lookup_1', hasToolResult: true },
      {
        content: 'Deleting it now. ',
        toolCalls: [{ id: 'call_delete_1', name: 'delete_file', arguments: { path: 'a.txt' } }],
      },
    );
    llm.on(
      { endpoint: 'chat', toolCallId: 'call_delete_1', hasToolResult: true },
      {
        content: 'Deleted a.txt. ',
        toolCalls: [{ id: 'call_lookup_2', name: 'lookup_file', arguments: { path: 'b.txt' } }],
      },
    );
    llm.on(
      { endpoint: 'chat', toolCallId: 'call_lookup_2', hasToolResult: true },
      {
        content: 'Deleting b.txt too. ',
        toolCalls: [{ id: 'call_delete_2', name: 'delete_file', arguments: { path: 'b.txt' } }],
      },
    );

    const shared = await createSharedAgent(llm, {
      tools: { lookup_file: lookupFile, delete_file: deleteFile },
      engine,
    });
    const run = (await shared.agent.stream('Delete a.txt, then b.txt.', {
      ...(isDurableEngineVariant(engine) ? { closeOnSuspend: true } : {}),
    } as never)) as unknown as RunHandle & { runId: string };
    const toolCallId = await drainToApproval(run);
    return { shared, output: outputOf(run), runId: outputOf(run).runId ?? run.runId, toolCallId };
  }

  it('includes the unfinished step text once a run suspends after a completed step', async () => {
    const { output, toolCallId } = await suspendAfterCompletedStep();
    expect(toolCallId).toBe('call_delete_1');

    const steps = await output.steps;
    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps[0]!.text).toBe('Checking the file. ');
    expect(await output.finishReason).toBe('suspended');

    const text = await output.text;
    expect(text).toBe('Checking the file. Deleting it now. ');
    expect((await output.getFullOutput()).text).toBe(text);
  });

  it('counts each text once when a resumed run completes a step and suspends again', async () => {
    const { shared, output, runId, toolCallId } = await suspendAfterCompletedStep();
    expect(toolCallId).toBe('call_delete_1');

    const resumedRun = (await shared.agent.approveToolCall({
      runId,
      toolCallId: toolCallId!,
      ...(isDurableEngineVariant(engine) ? { closeOnSuspend: true } : {}),
    } as never)) as unknown as RunHandle;
    expect(await drainToApproval(resumedRun)).toBe('call_delete_2');
    const resumed = outputOf(resumedRun);

    expect(await resumed.finishReason).toBe('suspended');
    const resumedSteps = await resumed.steps;
    expect(resumedSteps.map(step => step.text).join('')).toContain('Deleted a.txt. ');

    const text = await resumed.text;
    // Pre-approval text is restored and every segment appears exactly once.
    expect(text).toBe('Checking the file. Deleting it now. Deleted a.txt. Deleting b.txt too. ');
    expect((await resumed.getFullOutput()).text).toBe(text);
    expect(await output.text).toBe('Checking the file. Deleting it now. ');
  });
});
