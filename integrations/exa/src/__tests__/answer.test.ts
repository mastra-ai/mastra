import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAnswer = vi.fn();

vi.mock('exa-js', () => {
  class FakeExa {
    headers = { set: vi.fn() };
    search = vi.fn();
    findSimilar = vi.fn();
    getContents = vi.fn();
    answer = mockAnswer;
  }
  return { default: FakeExa };
});

import { createExaAnswerTool } from '../answer.js';

describe('createExaAnswerTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnswer.mockResolvedValue({
      answer: 'The capital of France is Paris.',
      citations: [
        {
          id: 'c1',
          url: 'https://wiki.example/Paris',
          title: 'Paris',
          publishedDate: '2024-01-01',
          author: 'Wiki',
          text: 'Paris is the capital...',
        },
      ],
      requestId: 'req-1',
      costDollars: { total: 0.003 },
    });
  });

  it('creates a tool with the correct id', () => {
    const tool = createExaAnswerTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('exa-answer');
  });

  it('returns answer text and mapped citations', async () => {
    const tool = createExaAnswerTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'What is the capital of France?' }, {} as any)) as any;

    expect(mockAnswer).toHaveBeenCalledWith('What is the capital of France?', {
      text: undefined,
      systemPrompt: undefined,
      userLocation: undefined,
    });
    expect(result.answer).toBe('The capital of France is Paris.');
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toEqual({
      id: 'c1',
      url: 'https://wiki.example/Paris',
      title: 'Paris',
      publishedDate: '2024-01-01',
      author: 'Wiki',
      text: 'Paris is the capital...',
    });
  });

  it('serializes object answers to JSON when outputSchema is used upstream', async () => {
    mockAnswer.mockResolvedValue({
      answer: { capital: 'Paris' },
      citations: [],
    });

    const tool = createExaAnswerTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'capital of France?' }, {} as any)) as any;
    expect(result.answer).toBe('{"capital":"Paris"}');
  });

  it('passes through systemPrompt and userLocation', async () => {
    const tool = createExaAnswerTool({ apiKey: 'test-key' });
    await tool.execute!(
      { query: 'q', text: true, systemPrompt: 'be terse', userLocation: 'US' },
      {} as any,
    );

    expect(mockAnswer).toHaveBeenCalledWith('q', {
      text: true,
      systemPrompt: 'be terse',
      userLocation: 'US',
    });
  });
});
