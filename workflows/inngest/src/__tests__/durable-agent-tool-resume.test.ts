/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/19699
 *
 * When a durable agent (createInngestAgent) suspends inside a tool and is then
 * resumed, the resume must deliver `resumeData` to that tool and drive the run
 * to completion. Previously the nested agentic-execution workflow re-ran from
 * scratch on resume: the tool re-executed with `resumeData === undefined`, its
 * memoized suspended step-update collided (AUTOMATIC_PARALLEL_INDEXING), and the
 * run never produced a tool result or final answer.
 */
import { createToolCallThenTextModel } from '@internal/workflow-test-utils';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createInngestAgent } from '../durable-agent';
import { InngestDurableStepIds } from '../durable-agent/create-inngest-agentic-workflow';
import {
  generateTestId,
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 });

async function loadLoopSnapshot(runId: string): Promise<any> {
  const store = await getSharedMastra().getStorage()?.getStore('workflows');
  return store?.loadWorkflowSnapshot({
    workflowName: InngestDurableStepIds.AGENTIC_LOOP,
    runId,
  });
}

async function pollForSuspended(runId: string, timeoutMs = 40_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = '(none)';
  while (Date.now() < deadline) {
    const snap = await loadLoopSnapshot(runId);
    if (snap?.status) {
      last = snap.status;
      if (snap.status === 'suspended') return snap.status;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return last;
}

function drainTypes(stream: AsyncIterable<any>, collectTypes: string[], textOut: { text: string }) {
  return (async () => {
    for await (const chunk of stream) {
      const type = (chunk as any)?.type;
      if (type) collectTypes.push(type);
      if (type === 'text-delta') textOut.text += (chunk as any)?.payload?.text ?? '';
    }
  })();
}

describe('durable agent tool suspend/resume (issue #19699)', () => {
  beforeAll(async () => {
    await setupSharedTestInfrastructure();
  });

  afterAll(async () => {
    await teardownSharedTestInfrastructure();
  });

  it('delivers resumeData to a suspended tool and completes the run', async () => {
    const testId = generateTestId();
    const mastra = getSharedMastra();
    const inngest = getSharedInngest();

    const resumeDataSeen: unknown[] = [];

    const requestApproval = createTool({
      id: 'request_approval',
      description: 'Ask the user to approve before continuing',
      inputSchema: z.object({ question: z.string() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      outputSchema: z.object({ approved: z.boolean() }),
      execute: async (input: any, context: any) => {
        const agentCtx = context?.agent ?? context ?? {};
        const { suspend, resumeData } = agentCtx;
        resumeDataSeen.push(resumeData);
        if (resumeData != null) {
          return { approved: resumeData.approved };
        }
        await suspend({ question: input.question });
        return { approved: false };
      },
    });

    const agent = new Agent({
      id: `resume-agent-${testId}`,
      name: 'Resume Agent',
      instructions: 'Call request_approval, then confirm.',
      // 1st model turn -> tool call (suspends); 2nd turn (after resume) -> final text.
      model: createToolCallThenTextModel('request_approval', { question: 'Proceed?' }, 'All done.') as any,
      tools: { request_approval: requestApproval },
    });

    const durableAgent = createInngestAgent({ agent, inngest });
    mastra.addAgent(durableAgent);

    const runId = `run-${testId}`;

    // 1) Stream until the tool suspends. The durable stream ends on the
    //    synthetic suspend event; assert on the persisted snapshot too.
    const first = await durableAgent.stream([{ role: 'user', content: 'Please proceed.' }], { runId });
    const firstTypes: string[] = [];
    const firstDrain = drainTypes(first.output.fullStream, firstTypes, { text: '' }).finally(() => first.cleanup());

    const suspendedStatus = await pollForSuspended(runId);
    await Promise.race([firstDrain, new Promise(r => setTimeout(r, 3000))]);

    expect(suspendedStatus).toBe('suspended');
    expect(firstTypes).toContain('tool-call-suspended');
    // The tool suspended on its first execution without resume data.
    expect(resumeDataSeen[0] == null).toBe(true);

    // 2) Resume with the approval payload and drain the continuation.
    const second = await durableAgent.resume(runId, { approved: true });
    const resumeTypes: string[] = [];
    const resumeText = { text: '' };
    await drainTypes(second.output.fullStream, resumeTypes, resumeText).finally(() => second.cleanup());

    // 3) The suspended tool must have received the resume payload, produced a
    //    tool result (not re-suspended), and the agent must have finished with
    //    its final answer.
    expect(resumeDataSeen).toContainEqual({ approved: true });
    expect(resumeTypes).toContain('tool-result');
    expect(resumeTypes).toContain('finish');
    expect(resumeTypes).not.toContain('tool-call-suspended');
    expect(resumeText.text).toContain('All done.');
  });
});
