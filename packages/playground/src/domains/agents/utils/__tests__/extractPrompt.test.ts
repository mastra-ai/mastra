import type { AgentInstructions } from '@mastra/core/agent';
import { describe, it, expect } from 'vitest';
import { extractPrompt } from '../extractPrompt';

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

  describe('content parts', () => {
    it('joins text parts with a blank line', () => {
      const input = {
        role: 'system',
        content: [
          { type: 'text', text: 'You are a helpful assistant' },
          { type: 'text', text: 'Be polite' },
        ],
      } as unknown as AgentInstructions;

      expect(extractPrompt(input)).toBe('You are a helpful assistant\n\nBe polite');
    });

    it('trims each part', () => {
      const input = {
        role: 'system',
        content: [
          { type: 'text', text: '  padded  ' },
          { type: 'text', text: '\n second \n' },
        ],
      } as unknown as AgentInstructions;

      expect(extractPrompt(input)).toBe('padded\n\nsecond');
    });

    it('accepts a bare string part', () => {
      const input = {
        role: 'system',
        content: ['  first  ', { type: 'text', text: 'second' }],
      } as unknown as AgentInstructions;

      expect(extractPrompt(input)).toBe('first\n\nsecond');
    });

    it('renders a part with no text as empty rather than throwing', () => {
      const input = {
        role: 'system',
        content: [
          { type: 'image', image: 'https://example.com/a.png' },
          { type: 'text', text: 'after' },
        ],
      } as unknown as AgentInstructions;

      expect(extractPrompt(input)).toBe('after');
    });

    it('returns an empty string when no part carries text', () => {
      const input = { role: 'system', content: [{ type: 'image' }] } as unknown as AgentInstructions;

      expect(extractPrompt(input)).toBe('');
    });
  });

  describe('when there are no instructions', () => {
    it('returns an empty string for undefined', () => {
      expect(extractPrompt(undefined)).toBe('');
    });

    it('returns an empty string for an empty array', () => {
      expect(extractPrompt([])).toBe('');
    });
  });

  describe('nested array input', () => {
    it('flattens messages whose content is itself a parts array', () => {
      const input = [
        { role: 'system', content: 'first' },
        { role: 'system', content: [{ type: 'text', text: 'second' }] },
      ] as unknown as AgentInstructions;

      expect(extractPrompt(input)).toBe('first\n\nsecond');
    });

    it('trims the joined result', () => {
      const input = [
        { role: 'system', content: '  first  ' },
        { role: 'system', content: '   ' },
      ] as unknown as AgentInstructions;

      expect(extractPrompt(input)).toBe('first');
    });
  });
});
