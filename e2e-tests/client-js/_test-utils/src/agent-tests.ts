import { describe, it, expect, beforeAll, inject } from 'vitest';
import { MastraClient } from '@mastra/client-js';
import { MID_STREAM_FAILURE_MESSAGE, MID_STREAM_FAILURE_PARTIAL_TEXT } from './server-setup';

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

    // A model that fails partway through a reply used to look like a finished run:
    // processDataStream resolved with the cut-off text and the error only went to
    // console.error, so callers (and useChat) showed half an answer as complete.
    describe('stream that fails mid-response', () => {
      it('rejects processDataStream with the model error after delivering the partial text', async () => {
        const response = await client.getAgent('midStreamFailureAgent').stream('hi');

        const chunks: any[] = [];
        await expect(
          response.processDataStream({
            onChunk: async chunk => {
              chunks.push(chunk);
            },
          }),
        ).rejects.toThrow(MID_STREAM_FAILURE_MESSAGE);

        const text = chunks
          .filter(chunk => chunk.type === 'text-delta')
          .map(chunk => chunk.payload.text)
          .join('');
        expect(text).toBe(MID_STREAM_FAILURE_PARTIAL_TEXT);
        expect(chunks.some(chunk => chunk.type === 'error')).toBe(true);
      });

      it('errors the response body for callers that read the stream directly', async () => {
        const response = await client.getAgent('midStreamFailureAgent').stream('hi');
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let received = '';

        const readAll = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) return;
            received += decoder.decode(value, { stream: true });
          }
        };

        await expect(readAll()).rejects.toThrow(MID_STREAM_FAILURE_MESSAGE);
        expect(received).toContain(MID_STREAM_FAILURE_PARTIAL_TEXT);
      });

      it('still resolves processDataStream for a reply that finishes normally', async () => {
        const response = await client.getAgent(agentName).stream('hi');
        const types: string[] = [];
        await response.processDataStream({
          onChunk: async chunk => {
            types.push(chunk.type);
          },
        });
        expect(types).toContain('finish');
        expect(types).not.toContain('error');
      });
    });
  });
}
