/**
 * AIMock Scenario: File-routed agent parity
 *
 * Proves that an agent assembled from the file-system convention
 * (`agents/<name>/config.ts` + `instructions.md` + `tools/*`) via
 * `assembleAgentFromFsEntry` and registered through `Mastra.__registerFsAgents`
 * runs **identically** to a code-registered `new Agent(...)` through the real
 * agentic loop.
 *
 * `fsRouted: true` makes the shared scenario harness build the agent the way the
 * bundler would: `instructions` becomes the `instructions.md` body and `tools`
 * become the discovered `tools/*` map. Every other behaviour — model turns, tool
 * execution, cross-turn message composition — flows through the same loop.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

// Durable wraps the agent with createDurableAgent, which is orthogonal to the
// fs-routing assembly path; the normal/evented engines fully cover loop parity.
describeForAllEngines(
  'AIMock loop scenario: file-routed agent parity',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('runs an instructions.md + tools/* agent through the full multi-step loop', async () => {
      const getWeather = createTool({
        id: 'get_weather',
        description: 'Get the current weather for a city',
        inputSchema: z.object({ city: z.string() }),
        outputSchema: z.object({ city: z.string(), tempF: z.number() }),
        execute: async ({ city }: { city: string }) => ({ city, tempF: 72 }),
      });

      const instructionsMd = 'You are a weather assistant. Always be concise and cite the temperature.';

      const { output, requests } = await runLoopScenario({
        engine,
        fsRouted: true,
        llm: getMock(),
        prompt: 'What is the weather in Paris?',
        // Treated as the instructions.md body for the file-routed agent.
        instructions: instructionsMd,
        // Treated as the discovered tools/* map.
        tools: { get_weather: getWeather },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          // Turn 1: model calls the file-routed tool.
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_w1', name: 'get_weather', arguments: { city: 'Paris' } }] },
          );
          // Turn 2: model sees the result and answers.
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'It is 72F in Paris.' });
        },
      });

      // Tool discovered from tools/* executed and its result was collected.
      const toolResults = await output.toolResults;
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0]?.payload?.toolCallId).toBe('call_w1');
      expect(toolResults[0]?.payload?.result).toEqual({ city: 'Paris', tempF: 72 });

      // The loop ran two turns, exactly as a code agent would.
      expect(requests).toHaveLength(2);

      // instructions.md landed as the system prompt in the first request.
      const turn1Messages = requests[0]?.body?.messages ?? [];
      const systemMessages = turn1Messages.filter((m: any) => m.role === 'system');
      expect(systemMessages.some((m: any) => String(m.content).includes('weather assistant'))).toBe(true);

      // The file-routed tool was advertised to the model under its discovered key.
      const turn1Tools = (requests[0]?.body?.tools ?? []) as Array<{ function?: { name?: string } }>;
      expect(turn1Tools.some(t => t.function?.name === 'get_weather')).toBe(true);

      // Turn 2 carried the tool result back to the model.
      const turn2Messages = requests[1]?.body?.messages ?? [];
      const toolMsgs = turn2Messages.filter((m: any) => m.role === 'tool');
      expect(toolMsgs).toHaveLength(1);
      expect(toolMsgs[0]?.tool_call_id).toBe('call_w1');

      const text = await output.text;
      expect(text).toContain('Paris');
    });

    it('produces the same loop output as an equivalent code-registered agent', async () => {
      const makeTool = () =>
        createTool({
          id: 'lookup',
          description: 'Look up a value',
          inputSchema: z.object({ key: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ key }: { key: string }) => ({ value: `value-for-${key}` }),
        });

      const instructions = 'You are a lookup assistant.';
      const prompt = 'Look up the answer.';

      const scriptFixtures = (llm: any) => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_l1', name: 'lookup', arguments: { key: 'answer' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The value is value-for-answer.' });
      };

      // Code-registered agent.
      const codeRun = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt,
        instructions,
        tools: { lookup: makeTool() },
        stopWhen: stepCountIs(5),
        fixtures: scriptFixtures,
      });
      const codeRequestCount = codeRun.requests.length;
      const codeText = await codeRun.output.text;
      const codeResults = await codeRun.output.toolResults;

      // One AIMock server is shared per suite; reset the captured journal so the
      // second run's request count is measured independently of the first.
      getMock().clearRequests();
      getMock().resetMatchCounts();

      // File-routed agent, same inputs.
      const fsRun = await runLoopScenario({
        engine,
        fsRouted: true,
        llm: getMock(),
        prompt,
        instructions,
        tools: { lookup: makeTool() },
        stopWhen: stepCountIs(5),
        fixtures: scriptFixtures,
      });
      const fsText = await fsRun.output.text;
      const fsResults = await fsRun.output.toolResults;

      expect(fsText).toBe(codeText);
      expect(fsResults.map(r => r.payload?.result)).toEqual(codeResults.map(r => r.payload?.result));

      // Same number of model turns either way.
      expect(fsRun.requests).toHaveLength(codeRequestCount);
    });
  },
  { skip: ['durable'] },
);
