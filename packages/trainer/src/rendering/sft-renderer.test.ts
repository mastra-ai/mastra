import { describe, it, expect } from 'vitest';
import { renderSftJsonl, getSftStats } from './sft-renderer';
import { parseJsonlBuffer } from './jsonl';
import type { Scorecard, AgentRunRecord, AgentCase } from '../types';

function createMockScorecard(
  caseId: string,
  messages: AgentCase['messages'],
  passedGates = true,
  compositeScore = 0.8,
): Scorecard {
  const input: AgentCase = {
    id: caseId,
    messages,
  };

  const run: AgentRunRecord = {
    caseId,
    input,
    outputText: messages.find(m => m.role === 'assistant')?.content || '',
    outputMessages: messages,
  };

  return {
    run,
    results: [{ scorerId: 'quality', score: compositeScore }],
    compositeScore,
    passedGates,
    gateResults: [],
  };
}

describe('renderSftJsonl', () => {
  it('should render scorecards to OpenAI chat format', () => {
    const scorecards: Scorecard[] = [
      createMockScorecard('case-1', [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]),
    ];

    const buffer = renderSftJsonl(scorecards);
    const parsed = parseJsonlBuffer(buffer);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toHaveProperty('messages');
    expect(parsed[0].messages).toHaveLength(3);
    expect(parsed[0].messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' });
    expect(parsed[0].messages[1]).toEqual({ role: 'user', content: 'Hello' });
    expect(parsed[0].messages[2]).toEqual({ role: 'assistant', content: 'Hi there!' });
  });

  it('should filter out scorecards that did not pass gates', () => {
    const scorecards: Scorecard[] = [
      createMockScorecard(
        'case-1',
        [
          { role: 'user', content: 'Good' },
          { role: 'assistant', content: 'Response' },
        ],
        true,
      ),
      createMockScorecard(
        'case-2',
        [
          { role: 'user', content: 'Bad' },
          { role: 'assistant', content: 'Response' },
        ],
        false,
      ),
    ];

    const buffer = renderSftJsonl(scorecards);
    const parsed = parseJsonlBuffer(buffer);

    expect(parsed).toHaveLength(1);
  });

  it('should skip examples without user or assistant messages', () => {
    const scorecards: Scorecard[] = [createMockScorecard('case-1', [{ role: 'system', content: 'System only' }])];

    const buffer = renderSftJsonl(scorecards);
    const parsed = parseJsonlBuffer(buffer);

    expect(parsed).toHaveLength(0);
  });
});

describe('getSftStats', () => {
  it('should compute statistics', () => {
    const scorecards: Scorecard[] = [
      createMockScorecard(
        'case-1',
        [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
        ],
        true,
        0.9,
      ),
      createMockScorecard(
        'case-2',
        [
          { role: 'user', content: 'Bye' },
          { role: 'assistant', content: 'Goodbye' },
        ],
        true,
        0.7,
      ),
      createMockScorecard(
        'case-3',
        [
          { role: 'user', content: 'Bad' },
          { role: 'assistant', content: 'Response' },
        ],
        false,
        0.3,
      ),
    ];

    const stats = getSftStats(scorecards);

    expect(stats.total).toBe(3);
    expect(stats.passed).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.avgScore).toBeCloseTo(0.8); // (0.9 + 0.7) / 2
  });
});
