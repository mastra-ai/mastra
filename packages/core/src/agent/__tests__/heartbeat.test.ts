import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';

function createMockModel(responseText: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text: responseText }],
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      warnings: [],
    }),
  });
}

function createAgent(overrides: Record<string, any> = {}) {
  return new Agent({
    id: 'heartbeat-test-agent',
    name: 'Heartbeat Test Agent',
    model: createMockModel(overrides.responseText ?? 'HEARTBEAT_OK Everything is fine.'),
    instructions: 'You are a monitoring agent.',
    heartbeat: {
      intervalMs: 1000,
      prompt: 'Check if all services are running.',
      ...overrides.heartbeat,
    },
    ...overrides.agentOverrides,
  });
}

describe('Agent Heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('runHeartbeatTick()', () => {
    it('should run an agent turn and return a result with status ok', async () => {
      const agent = createAgent();

      const result = await agent.runHeartbeatTick();

      expect(result).not.toBeNull();
      expect(result!.status).toBe('ok');
      expect(result!.text).toContain('HEARTBEAT_OK');
      expect(result!.timestamp).toBeInstanceOf(Date);
    });

    it('should return status alert when response does not start with HEARTBEAT_OK', async () => {
      const agent = createAgent({ responseText: 'WARNING: Service X is down!' });

      const result = await agent.runHeartbeatTick();

      expect(result).not.toBeNull();
      expect(result!.status).toBe('alert');
      expect(result!.text).toContain('WARNING');
    });

    it('should capture token usage from the model response', async () => {
      const agent = createAgent();

      const result = await agent.runHeartbeatTick();

      expect(result).not.toBeNull();
      expect(result!.usage).toBeDefined();
      expect(result!.usage!.inputTokens).toBe(10);
      expect(result!.usage!.outputTokens).toBe(20);
      expect(result!.usage!.totalTokens).toBe(30);
    });

    it('should call onHeartbeat callback with the result', async () => {
      const onHeartbeat = vi.fn();
      const agent = createAgent({ heartbeat: { onHeartbeat } });

      const result = await agent.runHeartbeatTick();

      expect(onHeartbeat).toHaveBeenCalledOnce();
      expect(onHeartbeat).toHaveBeenCalledWith(result);
    });

    it('should not crash if onHeartbeat callback throws', async () => {
      const onHeartbeat = vi.fn().mockRejectedValue(new Error('callback error'));
      const agent = createAgent({ heartbeat: { onHeartbeat } });

      const result = await agent.runHeartbeatTick();

      // Should still return the result despite callback failure
      expect(result).not.toBeNull();
      expect(result!.status).toBe('ok');
    });

    it('should return null when agent has no heartbeat config', async () => {
      const agent = new Agent({
        id: 'no-heartbeat',
        name: 'No Heartbeat Agent',
        model: createMockModel('Hello'),
        instructions: 'You are helpful.',
      });

      const result = await agent.runHeartbeatTick();

      expect(result).toBeNull();
    });
  });

  describe('preCheck gate', () => {
    it('should skip agent turn when preCheck returns false', async () => {
      const onHeartbeat = vi.fn();
      const agent = createAgent({
        heartbeat: {
          preCheck: () => false,
          onHeartbeat,
        },
      });

      const result = await agent.runHeartbeatTick();

      expect(result).toBeNull();
      expect(onHeartbeat).not.toHaveBeenCalled();
    });

    it('should run agent turn when preCheck returns true', async () => {
      const onHeartbeat = vi.fn();
      const agent = createAgent({
        heartbeat: {
          preCheck: () => true,
          onHeartbeat,
        },
      });

      const result = await agent.runHeartbeatTick();

      expect(result).not.toBeNull();
      expect(result!.status).toBe('ok');
      expect(onHeartbeat).toHaveBeenCalledOnce();
    });

    it('should support async preCheck', async () => {
      const agent = createAgent({
        heartbeat: {
          preCheck: async () => false,
        },
      });

      const result = await agent.runHeartbeatTick();

      expect(result).toBeNull();
    });
  });

  describe('dynamic prompt', () => {
    it('should support a function that returns a prompt string', async () => {
      const promptFn = vi.fn().mockReturnValue('Check database connections.');
      const agent = createAgent({
        heartbeat: {
          prompt: promptFn,
        },
      });

      await agent.runHeartbeatTick();

      expect(promptFn).toHaveBeenCalledOnce();
    });

    it('should support an async function prompt', async () => {
      const promptFn = vi.fn().mockResolvedValue('Check API endpoints.');
      const agent = createAgent({
        heartbeat: {
          prompt: promptFn,
        },
      });

      await agent.runHeartbeatTick();

      expect(promptFn).toHaveBeenCalledOnce();
    });
  });

  describe('startHeartbeat() / stopHeartbeat()', () => {
    it('should schedule periodic ticks', async () => {
      const onHeartbeat = vi.fn();
      const agent = createAgent({
        heartbeat: {
          intervalMs: 5000,
          onHeartbeat,
        },
      });

      agent.startHeartbeat();

      // No immediate run (default)
      expect(onHeartbeat).not.toHaveBeenCalled();

      // Advance past one interval
      await vi.advanceTimersByTimeAsync(5000);
      expect(onHeartbeat).toHaveBeenCalledTimes(1);

      // Advance past another interval
      await vi.advanceTimersByTimeAsync(5000);
      expect(onHeartbeat).toHaveBeenCalledTimes(2);

      agent.stopHeartbeat();
    });

    it('should run immediately when immediate is true', async () => {
      const onHeartbeat = vi.fn();
      const agent = createAgent({
        heartbeat: {
          intervalMs: 60000,
          immediate: true,
          onHeartbeat,
        },
      });

      agent.startHeartbeat();

      // Flush the microtask queue for the immediate tick
      await vi.advanceTimersByTimeAsync(0);

      expect(onHeartbeat).toHaveBeenCalledTimes(1);

      agent.stopHeartbeat();
    });

    it('should stop ticks after stopHeartbeat()', async () => {
      const onHeartbeat = vi.fn();
      const agent = createAgent({
        heartbeat: {
          intervalMs: 5000,
          onHeartbeat,
        },
      });

      agent.startHeartbeat();

      await vi.advanceTimersByTimeAsync(5000);
      expect(onHeartbeat).toHaveBeenCalledTimes(1);

      agent.stopHeartbeat();

      await vi.advanceTimersByTimeAsync(5000);
      // Should not have been called again
      expect(onHeartbeat).toHaveBeenCalledTimes(1);
    });

    it('should not throw when stopping without starting', () => {
      const agent = createAgent();
      expect(() => agent.stopHeartbeat()).not.toThrow();
    });

    it('should not throw when starting without heartbeat config', () => {
      const agent = new Agent({
        id: 'no-config',
        name: 'No Config Agent',
        model: createMockModel('Hello'),
        instructions: 'You are helpful.',
      });
      expect(() => agent.startHeartbeat()).not.toThrow();
    });
  });

  describe('overlap prevention', () => {
    it('should skip a tick if the previous one is still running', async () => {
      vi.useRealTimers(); // Need real timers for this test

      let resolveGenerate: (() => void) | undefined;
      let onGenerateEntered: (() => void) | undefined;
      const generateEntered = new Promise<void>(resolve => {
        onGenerateEntered = resolve;
      });

      const slowModel = new MockLanguageModelV2({
        doGenerate: async () => {
          onGenerateEntered!();
          await new Promise<void>(resolve => {
            resolveGenerate = resolve;
          });
          return {
            content: [{ type: 'text' as const, text: 'HEARTBEAT_OK' }],
            finishReason: 'stop' as const,
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            warnings: [],
          };
        },
      });

      const onHeartbeat = vi.fn();
      const agent = new Agent({
        id: 'overlap-test',
        name: 'Overlap Agent',
        model: slowModel,
        instructions: 'Monitor things.',
        heartbeat: {
          intervalMs: 1000,
          prompt: 'Check services.',
          onHeartbeat,
        },
      });

      // Start a tick (will be blocked by slow model)
      const tick1 = agent.runHeartbeatTick();

      // Wait until the model's doGenerate is actually entered
      await generateEntered;

      // Try a second tick — should be skipped because tick1 is still running
      const tick2 = await agent.runHeartbeatTick();
      expect(tick2).toBeNull();

      // Now unblock the first tick
      resolveGenerate!();
      const result1 = await tick1;

      expect(result1).not.toBeNull();
      expect(result1!.status).toBe('ok');
      expect(onHeartbeat).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should return null and not throw when generate() fails', async () => {
      vi.useRealTimers();

      const failingModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw new Error('Model API is down');
        },
      });

      const onHeartbeat = vi.fn();
      const agent = new Agent({
        id: 'error-test',
        name: 'Error Test Agent',
        model: failingModel,
        instructions: 'Monitor things.',
        heartbeat: {
          intervalMs: 1000,
          prompt: 'Check services.',
          onHeartbeat,
        },
      });

      const result = await agent.runHeartbeatTick();

      expect(result).toBeNull();
      expect(onHeartbeat).not.toHaveBeenCalled();
    });

    it('should still return result when onHeartbeat callback throws', async () => {
      const onHeartbeat = vi.fn().mockImplementation(() => {
        throw new Error('Callback blew up!');
      });
      const agent = createAgent({ heartbeat: { onHeartbeat } });

      const result = await agent.runHeartbeatTick();

      expect(result).not.toBeNull();
      expect(result!.status).toBe('ok');
      expect(onHeartbeat).toHaveBeenCalled();
    });

    it('should return null when preCheck throws', async () => {
      vi.useRealTimers();

      const agent = createAgent({
        heartbeat: {
          preCheck: async () => {
            throw new Error('preCheck exploded');
          },
          onHeartbeat: vi.fn(),
        },
      });

      const result = await agent.runHeartbeatTick();

      expect(result).toBeNull();
    });
  });

  describe('heartbeatActive getter', () => {
    it('should return true when heartbeat is running', async () => {
      const onHeartbeat = vi.fn();
      const agent = createAgent({ heartbeat: { onHeartbeat } });

      expect(agent.heartbeatActive).toBe(false);

      agent.startHeartbeat();
      expect(agent.heartbeatActive).toBe(true);

      agent.stopHeartbeat();
      expect(agent.heartbeatActive).toBe(false);
    });
  });

  describe('integration: heartbeat with tools', () => {
    it('should allow agent to use tools during heartbeat tick', async () => {
      vi.useRealTimers();

      const checkServiceStatus = vi.fn().mockResolvedValue({ status: 'healthy' });

      const serviceTool = createTool({
        id: 'check-service',
        description: 'Check a service status',
        inputSchema: z.object({ service: z.string() }),
        execute: checkServiceStatus,
      });

      // Model that calls the tool, then responds
      let callCount = 0;
      const toolCallingModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'tc-1',
                  toolName: 'check-service',
                  input: JSON.stringify({ service: 'database' }),
                },
              ],
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              warnings: [],
            };
          }
          return {
            content: [{ type: 'text' as const, text: 'HEARTBEAT_OK All services healthy.' }],
            finishReason: 'stop' as const,
            usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            warnings: [],
          };
        },
      });

      const onHeartbeat = vi.fn();
      const agent = new Agent({
        id: 'tool-heartbeat',
        name: 'Tool Heartbeat Agent',
        model: toolCallingModel,
        instructions: 'Monitor services.',
        tools: { checkService: serviceTool },
        heartbeat: {
          intervalMs: 30000,
          prompt: 'Check database service status.',
          onHeartbeat,
        },
      });

      const result = await agent.runHeartbeatTick();

      expect(result).not.toBeNull();
      expect(result!.status).toBe('ok');
      expect(checkServiceStatus).toHaveBeenCalledWith({ service: 'database' }, expect.anything());
    });
  });

  describe('integration: heartbeat with memory (contextMode: full)', () => {
    it('should pass memory options to generate when contextMode is full', async () => {
      vi.useRealTimers();

      const memory = new MockMemory();

      const agent = new Agent({
        id: 'memory-heartbeat-full',
        name: 'Memory Heartbeat Agent',
        model: createMockModel('HEARTBEAT_OK'),
        instructions: 'Monitor with memory.',
        memory,
        heartbeat: {
          intervalMs: 30000,
          prompt: 'Check everything.',
          contextMode: 'full',
          onHeartbeat: vi.fn(),
        },
      });

      // Spy on the agent's generate method
      const generateSpy = vi.spyOn(agent, 'generate');

      await agent.runHeartbeatTick();

      expect(generateSpy).toHaveBeenCalled();

      // Cast to any to access the second argument (options) since TS doesn't know about overloads
      const args = generateSpy.mock.calls[0] as unknown as [unknown, Record<string, unknown> | undefined];
      const options = args[1];

      // In full mode, memory option should be passed with heartbeat thread
      expect(options).toBeDefined();
      expect(options?.memory).toMatchObject({
        thread: expect.stringContaining('heartbeat-'),
        resource: 'heartbeat',
      });
    });

    it('should NOT pass memory options to generate when contextMode is light (default)', async () => {
      vi.useRealTimers();

      const memory = new MockMemory();

      const agent = new Agent({
        id: 'light-heartbeat',
        name: 'Light Heartbeat Agent',
        model: createMockModel('HEARTBEAT_OK All good.'),
        instructions: 'Monitor without memory.',
        memory,
        heartbeat: {
          intervalMs: 30000,
          prompt: 'Quick check.',
          // contextMode defaults to 'light'
          onHeartbeat: vi.fn(),
        },
      });

      // Spy on the agent's generate method
      const generateSpy = vi.spyOn(agent, 'generate');

      await agent.runHeartbeatTick();

      expect(generateSpy).toHaveBeenCalled();

      // Cast to any to access the second argument (options)
      const args = generateSpy.mock.calls[0] as unknown as [unknown, Record<string, unknown> | undefined];
      const options = args[1];

      // In light mode, memory option should NOT be passed (empty object)
      expect(options?.memory).toBeUndefined();
    });
  });

  describe('prompt content verification', () => {
    it('should include the checklist prompt in the message sent to the model', async () => {
      vi.useRealTimers();

      let capturedPrompt: unknown;
      const capturingModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          capturedPrompt = prompt;
          return {
            content: [{ type: 'text' as const, text: 'HEARTBEAT_OK' }],
            finishReason: 'stop' as const,
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            warnings: [],
          };
        },
      });

      const agent = new Agent({
        id: 'prompt-verify',
        name: 'Prompt Verify Agent',
        model: capturingModel,
        instructions: 'You are helpful.',
        heartbeat: {
          intervalMs: 30000,
          prompt: '1. Check API health\n2. Check database connection',
          onHeartbeat: vi.fn(),
        },
      });

      await agent.runHeartbeatTick();

      expect(capturedPrompt).toBeDefined();
      // The prompt should contain our checklist items
      const promptStr = JSON.stringify(capturedPrompt);
      expect(promptStr).toContain('Check API health');
      expect(promptStr).toContain('Check database connection');
      expect(promptStr).toContain('HEARTBEAT_OK');
    });
  });

  describe('restart scenarios', () => {
    it('should allow restarting heartbeat after stopping', async () => {
      const onHeartbeat = vi.fn();
      const agent = createAgent({ heartbeat: { intervalMs: 5000, onHeartbeat } });

      // First cycle
      agent.startHeartbeat();
      await vi.advanceTimersByTimeAsync(5000);
      expect(onHeartbeat).toHaveBeenCalledTimes(1);

      agent.stopHeartbeat();
      await vi.advanceTimersByTimeAsync(5000);
      expect(onHeartbeat).toHaveBeenCalledTimes(1); // No new calls

      // Restart
      agent.startHeartbeat();
      await vi.advanceTimersByTimeAsync(5000);
      expect(onHeartbeat).toHaveBeenCalledTimes(2);

      agent.stopHeartbeat();
    });

    it('should handle multiple sequential ticks correctly', async () => {
      const onHeartbeat = vi.fn();
      const agent = createAgent({ heartbeat: { intervalMs: 1000, onHeartbeat } });

      agent.startHeartbeat();

      // Run 5 ticks
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      expect(onHeartbeat).toHaveBeenCalledTimes(5);

      // Each call should have a valid result
      for (const call of onHeartbeat.mock.calls) {
        expect(call[0]).toMatchObject({
          status: 'ok',
          text: expect.stringContaining('HEARTBEAT_OK'),
          timestamp: expect.any(Date),
        });
      }

      agent.stopHeartbeat();
    });
  });
});
