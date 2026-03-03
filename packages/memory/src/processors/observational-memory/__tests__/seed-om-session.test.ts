import { describe, expect, it } from 'vitest';

import { buildRoundPrompt, buildSeedAgentInstructions, MASTRA_ROOT_URL } from './scripts/seed-om-session';
import {
  DEFAULT_PROMPT,
  DEFAULT_ROUNDS,
  DEFAULT_SEED_MODEL,
  formatRoundReport,
  parseSeedSessionArgs,
} from './scripts/seed-om-session.utils';

describe('seed-om-session script helpers', () => {
  it('uses expected defaults (including Cerebras model)', () => {
    const args = parseSeedSessionArgs([]);

    expect(args.model).toBe(DEFAULT_SEED_MODEL);
    expect(args.rounds).toBe(DEFAULT_ROUNDS);
    expect(args.prompt).toBe(DEFAULT_PROMPT);
    expect(args.threadId).toContain('seed-thread-');
    expect(args.resourceId).toContain('seed-resource-');
  });

  it('parses explicit cli arguments', () => {
    const args = parseSeedSessionArgs([
      '--threadId=t-123',
      '--resourceId=r-789',
      '--rounds=12',
      '--model=cerebras/zai-glm-4.7',
      '--prompt=custom prompt',
    ]);

    expect(args.threadId).toBe('t-123');
    expect(args.resourceId).toBe('r-789');
    expect(args.rounds).toBe(12);
    expect(args.model).toBe('cerebras/zai-glm-4.7');
    expect(args.prompt).toBe('custom prompt');
  });

  it('falls back to default rounds on invalid input', () => {
    const args = parseSeedSessionArgs(['--rounds=oops']);

    expect(args.rounds).toBe(DEFAULT_ROUNDS);
  });

  it('formats round report with cache ratio', () => {
    const report = formatRoundReport(2, {
      inputTokens: 100,
      cachedInputTokens: 25,
      outputTokens: 50,
      totalTokens: 150,
    });

    expect(report).toContain('round=2');
    expect(report).toContain('input=100');
    expect(report).toContain('cachedInput=25');
    expect(report).toContain('cacheRatio=25.00%');
  });

  it('builds round prompt that enforces crawling mastra.ai', () => {
    const prompt = buildRoundPrompt('research deeply', 2, 6);

    expect(prompt).toContain('Round 2/6');
    expect(prompt).toContain('crawl https://mastra.ai');
    expect(prompt).toContain('visited URLs');
  });

  it('builds agent instructions that force crawl tool usage', () => {
    const instructions = buildSeedAgentInstructions();

    expect(MASTRA_ROOT_URL).toBe('https://mastra.ai');
    expect(instructions).toContain('fetchUrl tool');
    expect(instructions).toContain('multiple tool calls');
  });
});
