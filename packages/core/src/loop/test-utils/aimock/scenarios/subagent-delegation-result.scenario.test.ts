import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it } from 'vitest';
import { Agent } from '../../../../agent';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * A sub-agent registered under `agents` is exposed to the supervisor as an
 * `agent-<key>` tool. Its tool result carries the sub-agent's final text plus
 * the thread, resource and tool results of the delegated run.
 *
 * Replaces the hash-matched `tool-handling.e2e` recording.
 */

const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-researchAgent');
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';

describeForAllEngines('AIMock loop scenario: sub-agent delegation result', engine => {
  const getMock = useLoopScenarioAimock();

  it('returns the sub-agent text and run identity as the agent-* tool result', async () => {
    const llm = getMock();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const researchAgent = new Agent({
      id: 'research-agent',
      name: 'research-agent',
      description: 'Researches topics',
      instructions: 'You are a research agent.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const { output } = await runLoopScenario({
      engine,
      llm,
      instructions: 'Delegate research tasks to specialized agents.',
      prompt: 'Use the research agent to find information about TypeScript',
      agents: { researchAgent },
      fixtures: m => {
        m.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'call-research-1', name: 'agent-researchAgent', arguments: { prompt: 'TypeScript' } }] },
        );
        m.on({ endpoint: 'chat', predicate: req => !isSupervisor(req) }, { content: 'TypeScript adds static types.' });
        m.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: 'TypeScript adds static types to JavaScript.' },
        );
      },
    });

    const toolResults = (await output.toolResults) as Array<{ payload: { toolName: string; result: unknown } }>;
    expect(toolResults.map(r => r.payload.toolName)).toEqual(['agent-researchAgent']);
    expect(toolResults[0]!.payload.result).toStrictEqual({
      text: 'TypeScript adds static types.',
      subAgentThreadId: expect.any(String),
      subAgentResourceId: expect.any(String),
      subAgentToolResults: [],
    });
  });
});
