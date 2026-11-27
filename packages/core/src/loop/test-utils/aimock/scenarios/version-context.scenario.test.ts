import { expect, it } from 'vitest';
import { z } from 'zod';
import type { DurableAgent } from '../../../../agent/durable/durable-agent';
import { MASTRA_VERSIONS_KEY, RequestContext } from '../../../../request-context';
import { MastraModelOutput } from '../../../../stream/base/output';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

describeForAllEngines('version selections reach tools and the model', engine => {
  const getMock = useLoopScenarioAimock();

  for (const method of ['generate', 'stream'] as const) {
    it(`${method} applies caller versions over request versions without losing other selections`, async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', sequenceIndex: 0 },
        {
          toolCalls: [{ id: 'read-versions', name: 'readVersions', arguments: {} }],
        },
      );
      llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Version selections received.' });
      const { agent } = await createSharedAgent(llm, {
        engine,
        tools: {
          readVersions: createTool({
            id: 'readVersions',
            description: 'Read the version selections available to this tool.',
            inputSchema: z.object({}),
            execute: async (_input, context) => context!.requestContext!.get(MASTRA_VERSIONS_KEY),
          }),
        },
      });
      const requestContext = new RequestContext();
      requestContext.set(MASTRA_VERSIONS_KEY, {
        agents: { selected: { versionId: 'request-version' }, retained: { versionId: 'retained-version' } },
      });
      const options = {
        requestContext,
        versions: { agents: { selected: { versionId: 'call-version' } } },
        maxSteps: 3,
      };
      if (method === 'generate') {
        const output = await agent.generate('Read the selected versions.', options);
        expect(output.text).toBe('Version selections received.');
      } else {
        const result = await (agent as typeof agent | DurableAgent).stream('Read the selected versions.', options);
        const output = result instanceof MastraModelOutput ? result : result.output;
        await output.consumeStream();
        expect(await output.text).toBe('Version selections received.');
        if (!(result instanceof MastraModelOutput)) result.cleanup();
      }
      const requests = llm.getRequests();
      expect(requests).toHaveLength(2);
      const messages = JSON.stringify(requests[1]!.body?.messages);
      expect(messages).toContain('call-version');
      expect(messages).toContain('retained-version');
      expect(messages).not.toContain('request-version');
    });
  }
});
