import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { getOpenAIModel, getSingleDummyResponseModel } from './mock-model';

setupDummyApiKeys(getLLMTestMode(), ['openai']);

const mock = createGatewayMock();
beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

function toolhandlingE2ETests(version: 'v2' | 'v3' | 'v4') {
  const dummyModel = getSingleDummyResponseModel(version);
  const openaiModel = getOpenAIModel(version);

  describe(`${version} - agents as tools`, () => {
    it('should expose sub-agents as tools when using generate/stream', async () => {
      // Create a research agent that will be used as a tool
      const researchAgent = new Agent({
        id: 'research-agent',
        name: 'research-agent',
        instructions: 'You are a research agent. Provide concise, factual information.',
        model: dummyModel,
      });

      // Create an orchestrator agent that has access to the research agent
      const orchestratorAgent = new Agent({
        id: 'orchestrator-agent',
        name: 'orchestrator-agent',
        instructions: 'You can delegate research tasks to specialized agents.',
        model: openaiModel,
        agents: {
          researchAgent,
        },
      });

      let result;
      let toolCalls;

      {
        result = await orchestratorAgent.generate('Use the research agent to find information about TypeScript');
        toolCalls = result.toolResults;
      }

      // Verify that the research agent was called as a tool
      expect(toolCalls.length).toBeGreaterThan(0);

      const agentToolCall = toolCalls.find((tc: any) => tc.payload?.toolName === 'agent-researchAgent');

      expect(toolCalls[0]?.payload?.result).toStrictEqual({
        ...{
          subAgentResourceId: expect.any(String),
          subAgentThreadId: expect.any(String),
          subAgentToolResults: expect.any(Array),
        },
        text: 'Dummy response',
      });

      expect(agentToolCall).toBeDefined();
    }, 50000);
  });
}

toolhandlingE2ETests('v2');
toolhandlingE2ETests('v3');
toolhandlingE2ETests('v4');
