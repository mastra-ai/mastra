/**
 * With `autoResumeSuspendedTools`, a message sent while a run is parked on a tool's
 * suspend() starts the next turn on the thread (#30190). Before it does, the runtime
 * may resolve the agent's default options, which may be a function that awaits. A
 * partial resume of the same run can register while that is in flight: it resumes
 * one of two suspended tool calls under the same run id, so the run is still parked
 * on the other one while its resumed segment executes. The message must not take the
 * thread from that segment.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { describeForAllEngines } from '../../loop/test-utils/aimock/aimock-scenario';
import { isDurableEngineVariant } from '../../loop/test-utils/aimock/types';
import type { EngineVariant } from '../../loop/test-utils/aimock/types';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { assembleAgentFromFsEntry } from '../fs-routing';

const RESOURCE = 'parked-release-user';
const REPLY = 'Here are both answers';

describeForAllEngines('auto-resume: a parked run released for a queued message', (engine: EngineVariant) => {
  let llm: LLMock;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterAll(async () => {
    await llm.stop();
  });

  // Durable runs resume through recovery rather than the process that holds their thread run, so a partial
  // resume never replaces the parked record there.
  // Technical: the release resolved dynamic default options, then released whatever record the run id held by
  // then. A partial resume had registered a running record under the same run id in the meantime; the parked
  // record it captured still read as suspended, so the resumed segment lost the thread and the reply turn ran
  // beside it. (#30190)
  it.skipIf(isDurableEngineVariant(engine))(
    'keeps the thread for a partially resumed run while the reply waits on dynamic defaults (#30190)',
    async () => {
      const threadId = `parked-release-${engine}-${globalThis.crypto.randomUUID()}`;
      llm.on(
        { userMessage: 'two questions' },
        {
          toolCalls: [
            { id: 'call_a', name: 'ask', arguments: { question: 'a' } },
            { id: 'call_b', name: 'ask', arguments: { question: 'b' } },
          ],
        },
      );
      llm.on({ userMessage: REPLY }, { content: 'REPLY_TURN' });
      // The resumed call's result goes back to the model while call_b stays suspended.
      llm.on({ toolCallId: 'call_a', hasToolResult: true }, { content: 'RESUMED_SEGMENT' });

      let releaseResumedCall!: () => void;
      const resumedCallReleased = new Promise<void>(resolve => (releaseResumedCall = resolve));
      const seen = { resumedCallRunning: false, replyRequestsWhileResumedCallRan: 0 };
      const replyRequests = () =>
        llm.getRequests().filter(request => JSON.stringify(request.body.messages).includes(REPLY)).length;
      // No suspend schema, so both calls of the step run, and suspend, side by side.
      const ask = createTool({
        id: 'ask',
        description: 'Asks the user a question',
        inputSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return await context?.agent?.suspend({ question: 'go?' });
          seen.resumedCallRunning = true;
          await resumedCallReleased;
          seen.replyRequestsWhileResumedCallRan = replyRequests();
          seen.resumedCallRunning = false;
          return 'answered';
        },
      });

      // Default options read per request, like a feature flag: auto-resume is turned on for the first run's
      // request after that run started, and reading it for that request takes a while. A run's options carry the
      // defaults it started with, so only a run started without the flag reads them again when a message arrives.
      const firstRunContext = new RequestContext<{ autoResume: boolean }>();
      let defaultsHeld = 0;
      let releaseDefaults!: () => void;
      const defaultsReleased = new Promise<void>(resolve => (releaseDefaults = resolve));
      const defaultOptions = async ({ requestContext }: { requestContext: RequestContext }) => {
        if (requestContext.get('autoResume') !== true) return {};
        if (requestContext === firstRunContext) {
          defaultsHeld++;
          await defaultsReleased;
        }
        return { autoResumeSuspendedTools: true };
      };

      const memory = new MockMemory();
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
      const model = openai('gpt-4o-mini');
      const agent =
        engine === 'fs'
          ? assembleAgentFromFsEntry({
              name: 'parked-release-agent',
              config: { model, memory, defaultOptions },
              instructionsMd: 'Ask, then answer.',
              tools: [{ key: 'ask', tool: ask }],
            })
          : new Agent({
              id: 'parked-release-agent',
              name: 'parked-release-agent',
              instructions: 'Ask, then answer.',
              model,
              memory,
              tools: { ask },
              defaultOptions,
            });
      const mastra = new Mastra({ agents: engine === 'fs' ? {} : { agent }, logger: false });
      if (engine === 'fs') mastra.__registerFsAgents({ agent });
      const registered = mastra.getAgent('agent');
      const view = await registered.subscribeToThread({ resourceId: RESOURCE, threadId });
      try {
        const first = await registered.stream('two questions', {
          memory: { thread: threadId, resource: RESOURCE },
          requestContext: firstRunContext,
        });
        await first.consumeStream();
        expect(first.status).toBe('suspended');
        const runId = first.runId;
        expect(view.activeRunId()).toBe(runId);

        // The reply is queued onto the parked run and waits on the run's default options.
        firstRunContext.set('autoResume', true);
        await registered.sendMessage(REPLY, { resourceId: RESOURCE, threadId }).accepted;
        await vi.waitFor(() => expect(defaultsHeld).toBeGreaterThan(0));

        // Meanwhile one of the two suspended calls resumes; the run stays parked on the other.
        const resumed = await registered.resumeStream(
          { answer: 'a' },
          {
            runId,
            toolCallId: 'call_a',
            memory: { thread: threadId, resource: RESOURCE },
            requestContext: new RequestContext([['autoResume', true]]),
          },
        );
        void resumed.consumeStream().catch(() => undefined);
        await vi.waitFor(() => expect(seen.resumedCallRunning).toBe(true));

        releaseDefaults();
        // Long enough for a reply turn that took the thread to reach the model.
        await new Promise(resolve => setTimeout(resolve, 300));
        // The resumed segment still holds the thread.
        expect(view.activeRunId()).toBe(runId);
        releaseResumedCall();

        await vi.waitFor(() => expect(seen.resumedCallRunning).toBe(false), { timeout: 5_000 });
        expect(seen.replyRequestsWhileResumedCallRan).toBe(0);
        // Once the resumed segment parks again on call_b, the reply starts the next turn.
        await vi.waitFor(() => expect(replyRequests()).toBeGreaterThan(0), { timeout: 5_000 });
      } finally {
        // A failed assertion must not leave the resumed call blocked or the run's Mastra instance running.
        releaseDefaults();
        releaseResumedCall();
        view.unsubscribe();
        await mastra.shutdown({ drainTimeout: 200 });
      }
    },
    20_000,
  );
});
