import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { getOpenAIModel, getSingleDummyResponseModel } from './mock-model';

function toolhandlingE2ETests(version: 'v1' | 'v2' | 'v3') {
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

      if (version === 'v1') {
        result = await orchestratorAgent.generateLegacy('Use the research agent to find information about TypeScript', {
          maxSteps: 2,
          toolChoice: 'required',
        });
        toolCalls = result.toolResults;
      } else {
        result = await orchestratorAgent.generate('Use the research agent to find information about TypeScript');
        toolCalls = result.toolResults;
      }

      // Verify that the research agent was called as a tool
      expect(toolCalls.length).toBeGreaterThan(0);

      const agentToolCall =
        version === 'v1'
          ? toolCalls.find((tc: any) => tc.toolName === 'agent-researchAgent')
          : toolCalls.find((tc: any) => tc.payload?.toolName === 'agent-researchAgent');

      expect(version === 'v1' ? toolCalls[0]?.result : toolCalls[0]?.payload?.result).toStrictEqual({
        ...(version === 'v1' ? {} : { subAgentResourceId: expect.any(String), subAgentThreadId: expect.any(String) }),
        text: 'Dummy response',
      });

      expect(agentToolCall).toBeDefined();
    }, 50000);
  });
}

toolhandlingE2ETests('v1');
toolhandlingE2ETests('v2');
toolhandlingE2ETests('v3');
