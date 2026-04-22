/**
 * LLM Judge Scorer (Offline, Experiment-only)
 *
 * Uses an LLM to evaluate the quality of a MastraCode session holistically.
 * Unlike the code-based scorers, this can assess nuanced qualities:
 * - Was the approach reasonable?
 * - Did the agent communicate clearly?
 * - Were there missed optimization opportunities?
 * - Was the final solution correct and maintainable?
 *
 * This is expensive (calls an LLM) so typically only used in experiment runs.
 * Recommended for negative-feedback traces and regression investigation.
 */

import { createScorer } from '@mastra/core/evals';
import type { MastraCodeExperimentOutput } from '../../experiments/lifecycle';
import type { MastraCodeGroundTruth, MastraCodeInput } from '../../experiments/types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const JUDGE_INSTRUCTIONS = `You are evaluating an AI coding agent session. You will be given:
1. The user's original request
2. The ground truth (expected outcome)
3. A summary of what the agent did (tool calls, errors, messages)

Score the session from 0.0 to 1.0 based on:
- **Correctness** (40%): Did the agent solve the problem correctly? Note: you only see tool calls and their results, not the actual file diffs. Infer correctness from exit codes, test results, and the agent's verification steps.
- **Methodology** (25%): Was the approach reasonable and efficient?
- **Communication** (15%): Did the agent explain clearly without over-explaining?
- **Robustness** (20%): Did the agent handle errors gracefully, verify its work?

Important guidelines:
- A session that achieves the correct outcome should score >= 0.7 even if the path was inefficient.
- A session that fails but demonstrates good methodology should score 0.3-0.5.
- Unnecessary ask_user calls when the agent could proceed autonomously reduce the score.
- Getting stuck in loops (retrying the same failing approach) is a major penalty.`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scorer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function createLlmJudgeScorer(modelId?: string) {
  const judgeModel = modelId ?? 'anthropic/claude-sonnet-4-20250514';

  return createScorer({
    id: 'mastracode-llm-judge',
    name: 'LLM Judge',
    description: 'LLM-based holistic evaluation of session quality.',
    judge: {
      model: judgeModel,
      instructions: JUDGE_INSTRUCTIONS,
    },
  })
    .preprocess(async ({ run }) => {
      const output = run.output as MastraCodeExperimentOutput | null;
      const groundTruth = run.groundTruth as MastraCodeGroundTruth | undefined;
      const input = run.input as MastraCodeInput | undefined;

      if (!output || !input) {
        return { prompt: 'No output or input available for evaluation.', skipped: true };
      }

      const prompt = buildJudgePrompt(input, output, groundTruth);
      return { prompt, skipped: false };
    })
    .generateScore({
      description: 'LLM judge evaluates session quality and returns a score from 0.0 to 1.0',
      judge: {
        model: judgeModel,
        instructions: JUDGE_INSTRUCTIONS,
      },
      createPrompt: ({ results }) => {
        const { prompt, skipped } = results.preprocessStepResult;
        if (skipped) return 'The session could not be evaluated. Return 0.5 as the score.';
        return `${prompt}\n\nReturn ONLY a number between 0.0 and 1.0 representing the overall quality score.`;
      },
    })
    .generateReason({
      description: 'LLM judge explains its scoring decision',
      judge: {
        model: judgeModel,
        instructions: JUDGE_INSTRUCTIONS,
      },
      createPrompt: ({ results, score }) => {
        const { prompt, skipped } = results.preprocessStepResult;
        if (skipped) return 'Session could not be evaluated.';
        return `${prompt}\n\nYou scored this session ${score}/1.0. In 2-3 sentences, explain why. Focus on what went well or poorly.`;
      },
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildJudgePrompt(
  input: MastraCodeInput,
  output: MastraCodeExperimentOutput,
  groundTruth?: MastraCodeGroundTruth,
): string {
  const lines: string[] = [];

  // User request
  lines.push('## User Request');
  lines.push(input.userMessage.slice(0, 2000));
  lines.push('');

  // Ground truth
  if (groundTruth) {
    lines.push('## Expected Outcome');
    if (groundTruth.buildPasses !== undefined) lines.push(`- Build should ${groundTruth.buildPasses ? 'pass' : 'fail'}`);
    if (groundTruth.testsPasses !== undefined) lines.push(`- Tests should ${groundTruth.testsPasses ? 'pass' : 'fail'}`);
    if (groundTruth.filesModified) lines.push(`- Should modify: ${groundTruth.filesModified.join(', ')}`);
    if (groundTruth.filesCreated) lines.push(`- Should create: ${groundTruth.filesCreated.join(', ')}`);
    if (groundTruth.toolsUsed) lines.push(`- Should use tools: ${groundTruth.toolsUsed.join(', ')}`);
    if (groundTruth.toolsNotUsed) lines.push(`- Should NOT use: ${groundTruth.toolsNotUsed.join(', ')}`);
    if (groundTruth.maxTurns) lines.push(`- Maximum turns: ${groundTruth.maxTurns}`);
    if (groundTruth.maxToolCalls) lines.push(`- Maximum tool calls: ${groundTruth.maxToolCalls}`);
    lines.push('');
  }

  // Session summary
  lines.push('## Session Summary');
  lines.push(`- Duration: ${output.completedAt - output.startedAt}ms`);
  lines.push(`- Tool calls: ${output.toolCalls.length}`);
  lines.push(`- Errors: ${output.errors.length}`);
  lines.push('');

  // Tool call timeline (truncated for token efficiency)
  lines.push('## Tool Call Timeline');
  const maxCalls = 30;
  const calls = output.toolCalls.slice(0, maxCalls);
  for (const tc of calls) {
    const argsStr = tc.args ? summarizeArgs(tc.args) : '';
    const errorStr = tc.error ? ` [ERROR: ${tc.error.slice(0, 100)}]` : '';
    lines.push(`- ${tc.toolName}(${argsStr})${errorStr}`);
  }
  if (output.toolCalls.length > maxCalls) {
    lines.push(`... and ${output.toolCalls.length - maxCalls} more calls`);
  }
  lines.push('');

  // Errors
  if (output.errors.length > 0) {
    lines.push('## Errors Encountered');
    for (const err of output.errors.slice(0, 5)) {
      lines.push(`- ${err.slice(0, 200)}`);
    }
  }

  return lines.join('\n');
}

function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return '';
  const obj = args as Record<string, unknown>;

  if ('path' in obj) return `path: "${obj.path}"`;
  if ('command' in obj) return `"${String(obj.command).slice(0, 80)}"`;
  if ('query' in obj) return `"${String(obj.query).slice(0, 60)}"`;
  if ('pattern' in obj) return `pattern: "${obj.pattern}"`;

  const keys = Object.keys(obj);
  return keys.slice(0, 3).join(', ');
}
