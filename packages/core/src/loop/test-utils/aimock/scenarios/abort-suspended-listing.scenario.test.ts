import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

describeForAllEngines('A resumed run is no longer listed as suspended once it finishes (#27619)', engine => {
  const getMock = useLoopScenarioAimock();

  async function approveAndCheckListing(llm: ReturnType<typeof getMock>, { abortFirst }: { abortFirst: boolean }) {
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_lookup', name: 'lookup_status', arguments: { query: 'alpha' } }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Status is OK.' });
    const lookup = createTool({
      id: 'lookup_status',
      description: 'Look up a status.',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        return { status: `OK:${query}` };
      },
    });
    const { agent } = await createSharedAgent(llm, { engine, tools: { lookup_status: lookup } });
    const isListed = async (runId: string) => (await agent.listSuspendedRuns()).runs.some(run => run.runId === runId);

    const output = await agent.stream('Look up alpha', { requireToolApproval: true, maxSteps: 5 });
    let approvalSeen = false;
    for await (const chunk of output.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        approvalSeen = true;
        break;
      }
    }
    expect(approvalSeen).toBe(true);
    if (engine === 'inngest') expect(await isListed(output.runId)).toBe(true);
    if (abortFirst) {
      expect(agent.abortRunStream(output.runId)).toBe(true);
    }

    let resumed;
    try {
      resumed = await agent.approveToolCall({ runId: output.runId, toolCallId: 'call_lookup' });
    } catch (error) {
      // Rejecting the approval of an aborted run is also a valid outcome (#27617);
      // what matters here is that the run does not stay listed as suspended.
      if (!abortFirst) throw error;
    }
    if (!abortFirst) expect(resumed).toBeDefined();
    if (resumed) {
      let finishSeen = false;
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'finish') {
          finishSeen = true;
          // Check on FINISH delivery: a run whose finish is visible must already be
          // unlisted, without waiting for background cleanup.
          expect(await isListed(output.runId)).toBe(false);
        }
      }
      expect(finishSeen).toBe(true);
    }

    expect(await isListed(output.runId)).toBe(false);
  }

  // Approval must be discoverable before resume and gone when finish is visible (#27898).
  it('drops an approved run from listSuspendedRuns() by the time its finish is delivered', async () => {
    await approveAndCheckListing(getMock(), { abortFirst: false });
  }, 30_000);

  it('drops an aborted-then-approved run from listSuspendedRuns() by the time its finish is delivered', async () => {
    await approveAndCheckListing(getMock(), { abortFirst: true });
  }, 30_000);
});
