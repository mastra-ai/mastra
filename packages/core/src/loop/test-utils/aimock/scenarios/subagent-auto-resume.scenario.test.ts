import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * A supervisor delegates a user lookup to a subagent. The subagent's lookup
 * tool suspends to ask for the user's age, which bubbles up as a suspended
 * `agent-userAgent` call. The customer answers on the same thread, and with
 * `autoResumeSuspendedTools` the supervisor resumes the subagent with that
 * answer instead of starting over.
 */
const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-userAgent');
const isSubagent = (req: ChatCompletionRequest) => toolNames(req).includes('findUserTool');
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';
const AUTO_RESUME_DIRECTIVE = 'Analyse the suspended tools';

describeForAllEngines(
  'AIMock loop scenario: subagent auto-resume',
  engine => {
    const getMock = useLoopScenarioAimock();

    async function setup(mock: LLMock) {
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
      const resumeAges: number[] = [];

      const findUserTool = createTool({
        id: 'find-user',
        description: 'Finds a user by name',
        inputSchema: z.object({ name: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ age: z.number() }),
        execute: async (input, context) => {
          if (!context?.agent?.resumeData) {
            return context?.agent?.suspend({ message: 'Please provide the age of the user' });
          }
          resumeAges.push(context.agent.resumeData.age);
          return { name: input.name, age: context.agent.resumeData.age, email: 'dero@test.com' };
        },
      });

      const userAgent = new Agent({
        id: 'userAgent',
        name: 'User Agent',
        description: 'Looks up users',
        instructions: 'You look up users with findUserTool.',
        model: openai(SCENARIO_MODEL_ID),
        tools: { findUserTool },
      });

      const memory = new MockMemory();
      const shared = await createSharedAgent(mock, {
        instructions: 'You are a support supervisor.',
        agents: { userAgent },
        memory,
        defaultOptions: { autoResumeSuspendedTools: true },
        engine,
      });
      return { shared, memory, resumeAges };
    }

    async function lookUpThenAnswer(mock: LLMock, { citeSuspension = true } = {}) {
      const { shared, memory, resumeAges } = await setup(mock);
      const threadId = 'subagent-auto-resume-thread';
      const resourceId = 'subagent-auto-resume-user';

      const first = await runLoopScenario({
        engine,
        llm: mock,
        sharedAgent: shared,
        prompt: 'Find the user Dero Israel',
        memory,
        threadId,
        resourceId,
        stopWhen: stepCountIs(5),
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
            {
              toolCalls: [
                { id: 'call-sub-1', name: 'agent-userAgent', arguments: { prompt: 'Find the user Dero Israel' } },
              ],
            },
          );
          llm.on(
            { endpoint: 'chat', predicate: req => isSubagent(req) && !lastIsToolResult(req) },
            { toolCalls: [{ id: 'call-find-1', name: 'findUserTool', arguments: { name: 'Dero Israel' } }] },
          );
        },
      });

      mock.clearFixtures();
      mock.clearRequests();

      const second = await runLoopScenario({
        engine,
        llm: mock,
        sharedAgent: shared,
        prompt: 'He is 25 years old',
        memory,
        threadId,
        resourceId,
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
            {
              toolCalls: [
                {
                  id: 'call-sub-2',
                  name: 'agent-userAgent',
                  arguments: {
                    prompt: 'Find the user Dero Israel',
                    resumeData: { age: 25 },
                    ...(citeSuspension ? { suspendedToolCallId: 'call-sub-1' } : {}),
                  },
                },
              ],
            },
          );
          llm.on(
            { endpoint: 'chat', predicate: req => isSubagent(req) && lastIsToolResult(req) },
            { content: 'Dero Israel, 25, dero@test.com' },
          );
          llm.on(
            { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
            { content: 'Found Dero Israel: 25 years old, dero@test.com.' },
          );
        },
      });

      return { first, second, resumeAges };
    }

    it('resumes the subagent with the answer the customer sends on the same thread', async () => {
      const mock = getMock();
      const { first, second, resumeAges } = await lookUpThenAnswer(mock);

      const suspended = first.chunks!.find(c => c.type === 'tool-call-suspended');
      expect(suspended?.payload.toolName).toBe('agent-userAgent');

      const supervisorResume = second.requests.find(r => isSupervisor(r.body));
      expect(JSON.stringify(supervisorResume?.body.messages)).toContain(AUTO_RESUME_DIRECTIVE);

      expect(resumeAges).toEqual([25]);
      expect(await second.output.text).toContain('Found Dero Israel');
    });

    it("keeps the supervisor's auto-resume instructions out of the resumed subagent", async () => {
      const mock = getMock();
      const { second } = await lookUpThenAnswer(mock);

      const subagentRequests = second.requests.filter(r => isSubagent(r.body));
      expect(subagentRequests.length).toBeGreaterThan(0);
      for (const req of subagentRequests) {
        expect(JSON.stringify(req.body.messages)).not.toContain(AUTO_RESUME_DIRECTIVE);
      }
    });

    // When the supervisor's model omits `suspendedToolCallId`, the subagent
    // starts a fresh run instead of resuming, and that run inherits the
    // supervisor's auto-resume instructions about tools the subagent doesn't have.
    // Skipped on Inngest: the subagent does not resume there (see above); not yet investigated.
    (engine === 'inngest' ? it.skip : it.fails)(
      "keeps the supervisor's auto-resume instructions out of a subagent that starts over",
      async () => {
        const mock = getMock();
        const { second } = await lookUpThenAnswer(mock, { citeSuspension: false });

        const subagentRequests = second.requests.filter(r => isSubagent(r.body));
        expect(subagentRequests.length).toBeGreaterThan(0);
        for (const req of subagentRequests) {
          expect(JSON.stringify(req.body.messages)).not.toContain(AUTO_RESUME_DIRECTIVE);
        }
      },
    );
  },
  { skip: ['fs'] },
);
