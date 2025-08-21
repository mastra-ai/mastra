import { describe, expect, test, vi } from 'vitest';
import { createToolCallAccuracyScorerLLM } from './index';

describe('createToolCallAccuracyScorerLLM', () => {
  test('should create scorer with correct configuration', () => {
    const mockModel = {} as any;
    const availableTools = [
      { name: 'weather-tool', description: 'Get weather information' },
      { name: 'calculator-tool', description: 'Perform calculations' },
    ];

    const scorer = createToolCallAccuracyScorerLLM({
      model: mockModel,
      availableTools,
    });

    expect(scorer.name).toBe('Tool Call Accuracy (LLM)');
    expect(scorer.description).toContain('Evaluates whether an agent selected appropriate tools');
  });

  test('should handle missing availableTools', () => {
    const mockModel = {} as any;

    const scorer = createToolCallAccuracyScorerLLM({
      model: mockModel,
      availableTools: [],
    });

    expect(scorer.name).toBe('Tool Call Accuracy (LLM)');
  });
});