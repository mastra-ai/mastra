import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: text that straddles a tool-approval boundary (#27504).
 *
 * The model streams text and a tool call in one step, the call waits for approval,
 * and the run is approved. The suspended stream's `text` settles with the text streamed
 * before the approval, and the resumed stream's `text` holds both the pre-approval and
 * the post-approval text.
 */
describeForAllEngines('AIMock loop scenario: text across a tool approval', engine => {
  const getMock = useLoopScenarioAimock();

  async function suspendWithText() {
    const lookups: string[] = [];
    const findUserTool = createTool({
      id: 'find-user',
      description: 'Finds a user by name',
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => {
        lookups.push(name);
        return { name, email: 'dero@mail.com' };
      },
    });
    const shared = await createSharedAgent(getMock(), { tools: { findUserTool }, engine });
    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Find the user Dero Israel',
      requireToolApproval: true,
      closeOnSuspend: true,
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            content: 'Let me look that up. ',
            toolCalls: [{ id: 'call-find-1', name: 'findUserTool', arguments: { name: 'Dero Israel' } }],
          },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call-find-1', hasToolResult: true }, { content: 'Found Dero Israel.' });
      },
    });
    const approval = chunks!.find(c => c.type === 'tool-call-approval');
    return { shared, output, chunks: chunks!, lookups, toolCallId: approval!.payload.toolCallId as string };
  }

  it('settles the suspended stream text with the text streamed before the approval', async () => {
    const { output, chunks } = await suspendWithText();

    expect(
      chunks
        .filter(c => c.type === 'text-delta')
        .map(c => c.payload.text)
        .join(''),
    ).toBe('Let me look that up. ');
    expect(await output.text).toBe('Let me look that up. ');
    expect(await output.finishReason).toBe('suspended');
  });

  it('includes the text streamed before an approval in the resumed stream text', async () => {
    const { shared, output, lookups, toolCallId } = await suspendWithText();

    const resumed = await shared.agent.approveToolCall({ runId: output.runId, toolCallId });
    const resumedDeltas: string[] = [];
    for await (const chunk of resumed.fullStream) {
      if (chunk.type === 'text-delta') resumedDeltas.push(chunk.payload.text);
    }

    expect(resumedDeltas.join('')).toBe('Found Dero Israel.');
    expect(await resumed.text).toBe('Let me look that up. Found Dero Israel.');
    expect((await resumed.getFullOutput()).text).toBe('Let me look that up. Found Dero Israel.');
    expect(lookups).toEqual(['Dero Israel']);
  });
});
