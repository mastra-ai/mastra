import { stepCountIs } from '@internal/ai-v7';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: onFinish callback.
 *
 * The onFinish callback fires when execution completes. This pins the callback
 * invocation path, ensuring final result observability works correctly.
 */
describeForAllEngines(
  'AIMock loop scenario: onFinish callback',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('onFinish fires when execution completes', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 1 }),
      });

      let finishCalled = false;
      let finishResult: any;

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Call tool then finish.',
        tools: { tick: tickTool },
        stopWhen: stepCountIs(3),
        onFinish: (result: any) => {
          finishCalled = true;
          finishResult = result;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      // Finish callback should have been called
      expect(finishCalled).toBe(true);

      // Should have received result
      expect(finishResult).toBeDefined();
    });

    it('onFinish receives text and steps', async () => {
      let resultText: string | undefined;
      let resultSteps: any[] | undefined;

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Simple test.',
        stopWhen: stepCountIs(1),
        onFinish: (result: any) => {
          resultText = result.text;
          resultSteps = result.steps;
        },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Test response.' });
        },
      });

      // Should have received text
      expect(resultText).toBeDefined();

      // Should have received steps
      expect(resultSteps).toBeDefined();
      expect(Array.isArray(resultSteps)).toBe(true);
    });

    it('onFinish fires after tool execution', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 1 }),
      });

      let toolResults: any[] | undefined;

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Call tool.',
        tools: { tick: tickTool },
        stopWhen: stepCountIs(3),
        onFinish: (result: any) => {
          toolResults = result.toolResults;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      // Should have received tool results
      expect(toolResults).toBeDefined();
      expect(Array.isArray(toolResults)).toBe(true);
      expect(toolResults!.length).toBeGreaterThan(0);
    });

    it('a defined onFinish does not swallow an API error from the stream', async () => {
      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Trigger an API error',
        collectChunks: true,
        onFinish: () => {},
        onError: () => {},
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat' },
            { error: { message: 'test error', type: 'server_error', code: 'server_error' }, status: 400 },
          );
        },
      });

      const error = chunks.find((c: any) => c.type === 'error');
      expect(error).toBeDefined();
      expect(JSON.stringify(error!.payload)).toContain('test error');
    });

    if (engine === 'normal' || engine === 'fs') {
      it('onChunk receives tool-error chunks when a tool throws', async () => {
        const seen: any[] = [];
        const boom = createTool({
          id: 'boom',
          description: 'Always throws.',
          inputSchema: z.object({}),
          execute: async () => {
            throw new Error('tool exploded');
          },
        });

        await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Call boom.',
          tools: { boom },
          stopWhen: stepCountIs(3),
          onChunk: (event: any) => {
            seen.push(event.chunk ?? event);
          },
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', hasToolResult: false },
              { toolCalls: [{ id: 'call_boom', name: 'boom', arguments: {} }] },
            );
            llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Recovered.' });
          },
        });

        const toolError = seen.find(c => c.type === 'tool-error');
        expect(toolError?.payload).toMatchObject({ toolCallId: 'call_boom', toolName: 'boom' });
        expect(JSON.stringify(toolError?.payload)).toContain('tool exploded');
      });
    }
  },
  {},
);
