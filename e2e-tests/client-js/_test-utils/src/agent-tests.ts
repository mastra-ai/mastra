import { describe, it, expect, beforeAll, inject } from 'vitest';
import { MastraClient } from '@mastra/client-js';

export interface AgentTestConfig {
  testNameSuffix?: string;
  agentName?: string;
}

export function createAgentTests(config: AgentTestConfig = {}) {
  const { testNameSuffix, agentName = 'testAgent' } = config;
  const suiteName = testNameSuffix ? `Agent Client JS E2E Tests (${testNameSuffix})` : 'Agent Client JS E2E Tests';

  let client: MastraClient;

  describe(suiteName, () => {
    beforeAll(async () => {
      const baseUrl = inject('baseUrl');
      client = new MastraClient({ baseUrl, retries: 0 });
    });

    describe('listAgents', () => {
      it('should return a record of agents', async () => {
        const agents = await client.listAgents();
        expect(agents).toBeDefined();
        expect(typeof agents).toBe('object');
        expect(agents[agentName]).toBeDefined();
      });

      it('should include agent structure with expected fields', async () => {
        const agents = await client.listAgents();
        const agent = agents[agentName];
        expect(agent).toBeDefined();
        expect(agent.name).toBe(agentName);
      });
    });

    describe('getAgent', () => {
      it('should return agent details', async () => {
        const agent = client.getAgent(agentName);
        const details = await agent.details();
        expect(details).toBeDefined();
        expect(details.name).toBe(agentName);
        expect(details.instructions).toBe('You are a helpful test assistant.');
      });

      it('should include tool information', async () => {
        const agent = client.getAgent(agentName);
        const details = await agent.details();
        expect(details).toBeDefined();
        expect(details.tools).toBeDefined();
        // The agent has calculator and greeter tools
        const toolIds = Object.keys(details.tools ?? {});
        expect(toolIds).toContain('calculator');
        expect(toolIds).toContain('greeter');
      });

      it('should throw for non-existent agent', async () => {
        const agent = client.getAgent('nonexistent-agent');
        await expect(agent.details()).rejects.toThrow();
      });
    });
  });
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
    port: number;
  }
}
