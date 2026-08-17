import { describe, expect, it } from 'vitest';
import { createAnalyzePrompt } from './prompts';

describe('Prompt Alignment prompts', () => {
  it('includes conversation context when provided', () => {
    const prompt = createAnalyzePrompt({
      userPrompt: 'A',
      systemPrompt: '',
      agentResponse: 'Confirmed option A.',
      evaluationMode: 'user',
      conversationContext: 'assistant: Please choose option A or option B.',
    });

    expect(prompt).toContain('Conversation Context:');
    expect(prompt).toContain('assistant: Please choose option A or option B.');
    expect(prompt).toContain('User Prompt:\nA');
  });

  it('keeps the current prompt format when context is omitted', () => {
    const prompt = createAnalyzePrompt({
      userPrompt: 'What is 2+2?',
      systemPrompt: '',
      agentResponse: '4',
      evaluationMode: 'user',
    });

    expect(prompt).not.toContain('Conversation Context:');
    expect(prompt).toContain('User Prompt:\nWhat is 2+2?');
  });
});
