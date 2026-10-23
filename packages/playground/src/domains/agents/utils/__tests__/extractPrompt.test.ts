import type { AgentInstructions } from '@mastra/core/agent';
import { describe, it, expect } from 'vitest';
import { extractPrompt } from '../extractPrompt';

describe('extractPrompt', () => {
  describe('when instructions are a string', () => {
    it('preserves leading whitespace, indentation, and trailing newlines', () => {
      const input = '\n    Keep this as code.\n\tKeep this tab.  \n';
      expect(extractPrompt(input)).toBe(input);
    });
  });

  describe('when instructions are a system message', () => {
    it('preserves the complete message content', () => {
      const input: AgentInstructions = {
        content: '\n  You are a helpful assistant\n    Keep this indentation.\n',
        role: 'system',
      };
      expect(extractPrompt(input)).toBe(input.content);
    });
  });

  describe('when instructions contain multiple strings', () => {
    it('preserves each string while separating instructions with a blank line', () => {
      expect(extractPrompt(['  First\n', '\tSecond  '])).toBe('  First\n\n\n\tSecond  ');
    });
  });

  describe('when instructions contain multiple system messages', () => {
    it('preserves each message while separating instructions with a blank line', () => {
      const input: AgentInstructions = [
        { content: '  First\n', role: 'system' },
        { content: '\tSecond  ', role: 'system' },
      ];
      expect(extractPrompt(input)).toBe('  First\n\n\n\tSecond  ');
    });
  });

  describe('when instructions are absent', () => {
    it('returns empty text', () => {
      expect(extractPrompt(undefined)).toBe('');
    });
  });
});
