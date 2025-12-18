import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Agent class before importing the wrapper
// The mock factory must be self-contained since vi.mock is hoisted
vi.mock('../../agent', () => {
  const MockAgent = vi.fn().mockImplementation(function (this: any, config: any) {
    Object.assign(this, config);
    this.generate = vi.fn();
  });
  return { Agent: MockAgent };
});

import { Agent } from '../../agent';
import { toolLoopAgentToMastraAgent, toolLoopAgentConfigToMastraAgent } from '../index';

// Mock ToolLoopAgent-like object (simulates what we'd get at runtime)
function createMockToolLoopAgent(settings: Record<string, unknown>) {
  return {
    id: settings.id,
    // Simulate the private settings property that exists at runtime
    settings: {
      ...settings,
    },
  };
}

describe('toolLoopAgentToMastraAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic property mapping', () => {
    it('should map id from ToolLoopAgent settings', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'You are a helpful assistant.',
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-agent',
          name: 'test-agent',
        }),
      );
    });

    it('should use default id when not provided', () => {
      const mockAgent = createMockToolLoopAgent({
        model: { modelId: 'gpt-4o' },
        instructions: 'You are a helpful assistant.',
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tool-loop-agent',
          name: 'tool-loop-agent',
        }),
      );
    });

    it('should map instructions', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'You are a weather assistant.',
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: 'You are a weather assistant.',
        }),
      );
    });

    it('should map model directly', () => {
      const mockModel = { modelId: 'gpt-4o', provider: 'openai' };
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: mockModel,
        instructions: 'Test',
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: mockModel,
        }),
      );
    });

    it('should map tools', () => {
      const mockTools = {
        weather: { description: 'Get weather', execute: vi.fn() },
        search: { description: 'Search web', execute: vi.fn() },
      };
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        tools: mockTools,
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: mockTools,
        }),
      );
    });

    it('should map maxRetries', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        maxRetries: 3,
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRetries: 3,
        }),
      );
    });
  });

  describe('model parameters mapping to defaultOptions', () => {
    it('should map temperature to defaultOptions', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        temperature: 0.7,
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultOptions: expect.objectContaining({
            temperature: 0.7,
          }),
        }),
      );
    });

    it('should map topP to defaultOptions', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        topP: 0.9,
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultOptions: expect.objectContaining({
            topP: 0.9,
          }),
        }),
      );
    });

    it('should map topK to defaultOptions', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        topK: 40,
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultOptions: expect.objectContaining({
            topK: 40,
          }),
        }),
      );
    });

    it('should map maxOutputTokens to maxTokens in defaultOptions', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        maxOutputTokens: 1000,
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultOptions: expect.objectContaining({
            maxTokens: 1000,
          }),
        }),
      );
    });

    it('should map presencePenalty to defaultOptions', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        presencePenalty: 0.5,
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultOptions: expect.objectContaining({
            presencePenalty: 0.5,
          }),
        }),
      );
    });

    it('should map frequencyPenalty to defaultOptions', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        frequencyPenalty: 0.3,
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultOptions: expect.objectContaining({
            frequencyPenalty: 0.3,
          }),
        }),
      );
    });

    it('should map stopSequences to defaultOptions', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        stopSequences: ['END', 'STOP'],
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultOptions: expect.objectContaining({
            stopSequences: ['END', 'STOP'],
          }),
        }),
      );
    });

    it('should map seed to defaultOptions', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        seed: 12345,
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultOptions: expect.objectContaining({
            seed: 12345,
          }),
        }),
      );
    });

    it('should map toolChoice to defaultOptions', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        toolChoice: 'auto',
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultOptions: expect.objectContaining({
            toolChoice: 'auto',
          }),
        }),
      );
    });

    it('should map multiple model parameters together', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 2000,
        toolChoice: 'required',
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultOptions: expect.objectContaining({
            temperature: 0.7,
            topP: 0.9,
            maxTokens: 2000,
            toolChoice: 'required',
          }),
        }),
      );
    });

    it('should not include defaultOptions when no model parameters set', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
      });

      toolLoopAgentToMastraAgent(mockAgent);

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultOptions: undefined,
        }),
      );
    });
  });

  describe('Mastra wrapper options', () => {
    it('should override name with wrapper options', () => {
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
      });

      toolLoopAgentToMastraAgent(mockAgent, { name: 'Custom Name' });

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-agent',
          name: 'Custom Name',
        }),
      );
    });

    it('should pass memory from wrapper options', () => {
      const mockMemory = { type: 'memory' } as any;
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
      });

      toolLoopAgentToMastraAgent(mockAgent, { memory: mockMemory });

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          memory: mockMemory,
        }),
      );
    });

    it('should pass scorers from wrapper options', () => {
      const mockScorers = [{ name: 'test-scorer' }] as any;
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
      });

      toolLoopAgentToMastraAgent(mockAgent, { scorers: mockScorers });

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          scorers: mockScorers,
        }),
      );
    });

    it('should pass input/output processors from wrapper options', () => {
      const mockInputProcessors = [{ process: vi.fn() }] as any;
      const mockOutputProcessors = [{ process: vi.fn() }] as any;
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
      });

      toolLoopAgentToMastraAgent(mockAgent, {
        inputProcessors: mockInputProcessors,
        outputProcessors: mockOutputProcessors,
      });

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          inputProcessors: mockInputProcessors,
          outputProcessors: mockOutputProcessors,
        }),
      );
    });

    it('should pass mastra instance from wrapper options', () => {
      const mockMastra = { type: 'mastra' } as any;
      const mockAgent = createMockToolLoopAgent({
        id: 'test-agent',
        model: { modelId: 'gpt-4o' },
        instructions: 'Test',
      });

      toolLoopAgentToMastraAgent(mockAgent, { mastra: mockMastra });

      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          mastra: mockMastra,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should throw error when settings cannot be extracted', () => {
      const invalidAgent = { id: 'test' }; // No settings property

      expect(() => toolLoopAgentToMastraAgent(invalidAgent)).toThrow('Could not extract settings from ToolLoopAgent');
    });
  });
});

describe('toolLoopAgentConfigToMastraAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept config directly without ToolLoopAgent instance', () => {
    const config = {
      id: 'config-agent',
      model: { modelId: 'gpt-4o' },
      instructions: 'You are helpful.',
      temperature: 0.5,
    };

    toolLoopAgentConfigToMastraAgent(config as any);

    expect(Agent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'config-agent',
        instructions: 'You are helpful.',
        defaultOptions: expect.objectContaining({
          temperature: 0.5,
        }),
      }),
    );
  });

  it('should work the same as toolLoopAgentToMastraAgent for equivalent config', () => {
    const config = {
      id: 'test-agent',
      model: { modelId: 'gpt-4o' },
      instructions: 'Test instructions',
      temperature: 0.7,
      maxRetries: 2,
    };

    // Clear mocks between calls
    vi.clearAllMocks();
    toolLoopAgentConfigToMastraAgent(config as any);
    const configCall = vi.mocked(Agent).mock.calls[0]![0];

    vi.clearAllMocks();
    const mockAgent = createMockToolLoopAgent(config);
    toolLoopAgentToMastraAgent(mockAgent);
    const instanceCall = vi.mocked(Agent).mock.calls[0]![0];

    // Both should produce equivalent Agent configs
    expect(configCall).toEqual(instanceCall);
  });
});
