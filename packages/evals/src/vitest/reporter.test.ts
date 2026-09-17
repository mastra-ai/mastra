import { describe, expect, it } from 'vitest';

import type { MastraEvalMeta } from './meta';
import { MastraEvalsReporter } from './reporter';

const reporter = new MastraEvalsReporter({ color: false });

describe('MastraEvalsReporter.render', () => {
  it('renders scores, gates, thresholds and a summary line', () => {
    const meta: MastraEvalMeta = {
      scores: { relevance: 0.812, safety: 1 },
      totalItems: 3,
      verdict: 'passed',
      gateResults: [{ id: 'safety', passed: true, score: 1 }],
      thresholdResults: [{ id: 'relevance', passed: true, averageScore: 0.812, threshold: 0.5 }],
    };

    const output = reporter.render([{ fullName: 'support agent > quality', meta }]);

    expect(output).toMatchInlineSnapshot(`
      "
       Mastra Evals 

      ✓ support agent > quality (3 items)
         safety (gate)                     1.0  ✓
         relevance (threshold: min 0.5)  0.812  ✓

       Eval runs: 1 (1 passed)
      "
    `);
  });

  it('renders failed runs and scorers without gates/thresholds', () => {
    const passed: MastraEvalMeta = {
      scores: { quality: 0.9 },
      totalItems: 1,
    };
    const failed: MastraEvalMeta = {
      scores: {},
      totalItems: 2,
      verdict: 'failed',
      gateResults: [{ id: 'no-refusal', passed: false, score: 0.5 }],
    };

    const output = reporter.render([
      { fullName: 'scored only', meta: passed },
      { fullName: 'gated run', meta: failed },
    ]);

    expect(output).toContain('• scored only (1 item)');
    expect(output).toContain('   quality    0.9');
    expect(output).toContain('✗ gated run (2 items)');
    expect(output).toContain('   no-refusal (gate)    0.5  ✗');
    expect(output).toContain('Eval runs: 2 (1 failed, 1 scored)');
  });

  it('does not duplicate scorers already covered by gates/thresholds', () => {
    const meta: MastraEvalMeta = {
      scores: { relevance: 0.812, extra: 0.5 },
      totalItems: 1,
      verdict: 'passed',
      thresholdResults: [{ id: 'relevance', passed: true, averageScore: 0.812, threshold: 0.5 }],
      turnResults: [
        {
          index: 0,
          scores: { tone: 0.7 },
          gateResults: [{ id: 'tone', passed: true, score: 0.7 }],
        },
      ],
    };

    const output = reporter.render([{ fullName: 'dedupe run', meta }]);

    expect(output.match(/relevance/g)).toHaveLength(1);
    expect(output.match(/tone/g)).toHaveLength(1);
    expect(output).toContain('extra');
  });

  it('renders object thresholds with min/max', () => {
    const meta: MastraEvalMeta = {
      scores: { tone: 0.4 },
      totalItems: 1,
      verdict: 'passed',
      thresholdResults: [{ id: 'tone', passed: true, averageScore: 0.4, threshold: { min: 0.2, max: 0.6 } }],
    };

    const output = reporter.render([{ fullName: 'tone check', meta }]);
    expect(output).toContain('tone (threshold: min 0.2, max 0.6)');
  });
});
