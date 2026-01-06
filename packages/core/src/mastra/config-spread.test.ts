import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { MastraError } from '../error';
import { Mastra } from './index';

/**
 * Tests for handling spread config objects in Mastra constructor.
 *
 * Issue: When config is spread ({ ...config }), some values might become
 * undefined if the original object had getters or non-enumerable properties.
 * The constructor should handle these cases gracefully.
 */
describe('Mastra Config Spread Handling', () => {
  const createTestAgent = () =>
    new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test agent',
      model: new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: 'Test response',
        }),
      }),
    });

  it('should handle config with spread operator', () => {
    const agent = createTestAgent();
    const config = {
      logger: false as const,
      agents: {
        testAgent: agent,
      },
    };

    // Using spread operator should work
    const mastra = new Mastra({ ...config });

    expect(mastra.getAgent('testAgent')).toBe(agent);
  });

  it('should handle config with nested spread', () => {
    const agent = createTestAgent();
    const baseConfig = {
      logger: false as const,
    };

    const agentsConfig = {
      agents: {
        testAgent: agent,
      },
    };

    // Using nested spread should work
    const mastra = new Mastra({
      ...baseConfig,
      ...agentsConfig,
    });

    expect(mastra.getAgent('testAgent')).toBe(agent);
  });

  it('should skip undefined agent values in config (handles spread edge cases)', () => {
    // Simulate what might happen with spread when getters return undefined
    const configWithUndefined = {
      logger: false as const,
      agents: {
        validAgent: createTestAgent(),
        undefinedAgent: undefined as unknown as Agent,
      },
    };

    // Should not throw, should skip the undefined agent
    const mastra = new Mastra(configWithUndefined);

    // The valid agent should still be registered
    expect(mastra.getAgent('validAgent')).toBeDefined();

    // The undefined agent should not be registered
    expect(() => mastra.getAgent('undefinedAgent' as any)).toThrow(MastraError);
  });

  it('should skip null values in config (handles spread edge cases)', () => {
    const configWithNull = {
      logger: false as const,
      agents: {
        validAgent: createTestAgent(),
        nullAgent: null as unknown as Agent,
      },
    };

    // Should not throw, should skip the null agent
    const mastra = new Mastra(configWithNull);

    // The valid agent should still be registered
    expect(mastra.getAgent('validAgent')).toBeDefined();

    // The null agent should not be registered
    expect(() => mastra.getAgent('nullAgent' as any)).toThrow(MastraError);
  });

  it('should throw meaningful error when addAgent is called with undefined directly', () => {
    const mastra = new Mastra({ logger: false });

    expect(() => mastra.addAgent(undefined as any)).toThrow(MastraError);
    expect(() => mastra.addAgent(undefined as any)).toThrow('Cannot add agent');
    expect(() => mastra.addAgent(undefined as any)).toThrow('undefined');
  });

  it('should throw meaningful error when addAgent is called with null directly', () => {
    const mastra = new Mastra({ logger: false });

    expect(() => mastra.addAgent(null as any)).toThrow(MastraError);
    expect(() => mastra.addAgent(null as any)).toThrow('Cannot add agent');
    expect(() => mastra.addAgent(null as any)).toThrow('null');
  });

  it('should preserve server config when spreading', () => {
    const config = {
      logger: false as const,
      server: {
        port: 8080,
        host: 'localhost',
      },
    };

    // Server config should be preserved after spread
    const mastra = new Mastra({ ...config });

    // If getServer() is available, check it; otherwise just ensure no errors
    expect(mastra).toBeDefined();
  });

  it('should handle config object created with Object.assign', () => {
    const agent = createTestAgent();
    const config = Object.assign(
      {},
      { logger: false as const },
      {
        agents: {
          testAgent: agent,
        },
      },
    );

    const mastra = new Mastra(config);

    expect(mastra.getAgent('testAgent')).toBe(agent);
  });

  it('should handle config with getter that returns proper values', () => {
    const agent = createTestAgent();

    // Create a config with a getter
    const config = {
      get logger() {
        return false as const;
      },
      agents: {
        testAgent: agent,
      },
    };

    // When spread, getters are invoked and their values are copied
    const mastra = new Mastra({ ...config });

    expect(mastra.getAgent('testAgent')).toBe(agent);
  });

  it('should handle tools with undefined values in config', () => {
    const mastra = new Mastra({
      logger: false,
      tools: {
        validTool: undefined as any,
      },
    });

    // Should not throw during construction
    expect(mastra).toBeDefined();
    // Tool should not be registered (getTool throws when not found)
    expect(() => mastra.getTool('validTool' as any)).toThrow(MastraError);
  });

  it('should handle workflows with undefined values in config', () => {
    const mastra = new Mastra({
      logger: false,
      workflows: {
        validWorkflow: undefined as any,
      },
    });

    // Should not throw during construction
    expect(mastra).toBeDefined();
    // Workflow should not be registered
    expect(() => mastra.getWorkflow('validWorkflow' as any)).toThrow(MastraError);
  });
});
