import { createOpenAI } from '@ai-sdk/openai-v5';
import type { LLMock } from '@copilotkit/aimock';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { Agent } from '../../../../agent';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage';
import type { ToolHooks } from '../../../../tools/types';
import { executeCommandTool } from '../../../../workspace/tools/execute-command';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: a blocking `beforeToolCall` hook on a workspace sandbox tool (#28753).
 *
 * Mastra Code's PreToolUse hooks block a tool by returning `{ error: reason }` as
 * the substitute output. Sandbox tools run that output through
 * `sandboxToModelOutput`, which used to pass objects through untagged, so the
 * provider built an empty tool result and the model never saw the reason.
 */
describeForAllEngines('AIMock loop scenario: sandbox tool blocked by beforeToolCall hook', engine => {
  const getMock = useLoopScenarioAimock();

  it('sends the block reason to the model as the execute_command tool result', async () => {
    const execute = vi.spyOn(executeCommandTool, 'execute');
    const llm = getMock();

    const { requests } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Delete scratch.txt.',
      stopWhen: stepCountIs(3),
      sharedAgent: buildAgent(llm, {
        beforeToolCall: () => ({ proceed: false, output: { error: 'Blocked by test hook' } }),
      }),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_rm', name: 'execute_command', arguments: { command: 'rm ./scratch.txt' } }],
          },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_rm', hasToolResult: true },
          { content: 'The command was blocked.' },
        );
      },
    });

    expect(execute).not.toHaveBeenCalled();
    expect(requests).toHaveLength(2);

    const toolMessage = (
      requests[1]!.body.messages as Array<{ role: string; tool_call_id?: string; content?: unknown }>
    )
      .filter(message => message.role === 'tool' && message.tool_call_id === 'call_rm')
      .at(0);
    expect(toolMessage?.content).toBe('Blocked by test hook');
    execute.mockRestore();
  });
});

let agentCounter = 0;

function buildAgent(llm: LLMock, hooks: ToolHooks): { agent: Agent; mastra: Mastra } {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
  const id = `sandbox-hook-block-agent-${++agentCounter}`;
  const agent = new Agent({
    id,
    name: id,
    instructions: 'You are a test agent driven by scripted AIMock responses.',
    model: openai(SCENARIO_MODEL_ID),
    tools: { execute_command: executeCommandTool },
    hooks,
  });
  const mastra = new Mastra({ agents: { [id]: agent }, logger: false, storage: new InMemoryStore() });
  return { agent: mastra.getAgent(id), mastra };
}
