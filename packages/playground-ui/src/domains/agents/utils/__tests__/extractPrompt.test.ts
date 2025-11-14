import { describe, it, expect } from 'vitest';
import { extractPrompt } from '../extractPrompt';
import { AgentInstructions } from '@mastra/core/agent';

describe('extractPrompt', () => {
  describe('string input', () => {
    it('should return trimmed string for simple string input', () => {
      const input = 'You are a helpful assistant';
      expect(extractPrompt(input)).toBe('You are a helpful assistant');
    });

    it('should trim whitespace from string input', () => {
      const input = '  You are a helpful assistant  ';
      expect(extractPrompt(input)).toBe('You are a helpful assistant');
    });
  });

  describe('object input', () => {
    it('should return trimmed string for simple object input', () => {
      const input: AgentInstructions = { content: 'You are a helpful assistant', role: 'system' };
      expect(extractPrompt(input)).toBe('You are a helpful assistant');
    });

    it('should return trimmed string for object input with multiple parts', () => {
      const input: AgentInstructions = {
        content: 'You are a helpful assistant\nYou should be polite and professional',
        role: 'system',
      };
      expect(extractPrompt(input)).toBe('You are a helpful assistant\nYou should be polite and professional');
    });
  });

  describe('array input', () => {
    it('should return trimmed string for simple array input', () => {
      const input: AgentInstructions = [{ content: 'You are a helpful assistant', role: 'system' }];
      expect(extractPrompt(input)).toBe('You are a helpful assistant');
    });

    it('should return trimmed string for simple array input', () => {
      const input: AgentInstructions = [
        { content: 'You are a helpful assistant', role: 'system' },
        { content: 'You should be polite and professional', role: 'system' },
      ];
      expect(extractPrompt(input)).toBe('You are a helpful assistant\n\nYou should be polite and professional');
    });
  });
});
