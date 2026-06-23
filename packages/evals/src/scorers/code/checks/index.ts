import { createScorer } from '@mastra/core/evals';
import stringSimilarity from 'string-similarity';
import { extractToolCalls, getTextContentFromMastraDBMessage } from '../../utils';

// ─── Output Text Checks ───────────────────────────────────────────────────────

export interface IncludesOptions {
  /** Case-insensitive match (default: true) */
  ignoreCase?: boolean;
}

/**
 * Scores 1 if the agent's output text contains the expected substring, 0 otherwise.
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 * const scorer = checks.includes('sunny');
 * ```
 */
export function includes(expected: string, options: IncludesOptions = {}) {
  const { ignoreCase = true } = options;
  return createScorer({
    id: 'check-includes',
    name: 'Includes Check',
    description: `Checks if output includes "${expected}"`,
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      let output = run.output.map(m => getTextContentFromMastraDBMessage(m)).join(' ');
      let target = expected;
      if (ignoreCase) {
        output = output.toLowerCase();
        target = target.toLowerCase();
      }
      return { output, target, found: output.includes(target) };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.found ? 1 : 0;
    });
}

/**
 * Scores 1 if the agent's output text does NOT contain the substring, 0 otherwise.
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 * const scorer = checks.excludes('error');
 * ```
 */
export function excludes(unwanted: string, options: IncludesOptions = {}) {
  const { ignoreCase = true } = options;
  return createScorer({
    id: 'check-excludes',
    name: 'Excludes Check',
    description: `Checks that output does not include "${unwanted}"`,
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      let output = run.output.map(m => getTextContentFromMastraDBMessage(m)).join(' ');
      let target = unwanted;
      if (ignoreCase) {
        output = output.toLowerCase();
        target = target.toLowerCase();
      }
      return { output, target, excluded: !output.includes(target) };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.excluded ? 1 : 0;
    });
}

/**
 * Scores 1 if the output text exactly equals the expected string (after optional normalization).
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 * const scorer = checks.equals('Hello, world!');
 * ```
 */
export function equals(expected: string, options: IncludesOptions = {}) {
  const { ignoreCase = true } = options;
  return createScorer({
    id: 'check-equals',
    name: 'Equals Check',
    description: `Checks if output equals "${expected}"`,
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      let output = run.output
        .filter(m => m.role === 'assistant')
        .map(m => getTextContentFromMastraDBMessage(m))
        .join('');
      let target = expected;
      if (ignoreCase) {
        output = output.toLowerCase();
        target = target.toLowerCase();
      }
      return { output, target, isEqual: output === target };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.isEqual ? 1 : 0;
    });
}

export interface MatchesOptions {
  /** If true, the output must match the pattern exactly (anchored). Default: false (substring match). */
  exact?: boolean;
}

/**
 * Scores 1 if the output matches the given regular expression, 0 otherwise.
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 * const scorer = checks.matches(/\d{1,3}°[FC]/);
 * ```
 */
export function matches(pattern: RegExp, options: MatchesOptions = {}) {
  const { exact = false } = options;
  return createScorer({
    id: 'check-matches',
    name: 'Matches Check',
    description: `Checks if output matches pattern ${pattern}`,
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      const output = run.output
        .filter(m => m.role === 'assistant')
        .map(m => getTextContentFromMastraDBMessage(m))
        .join('');
      const regex = exact ? new RegExp(`^${pattern.source}$`, pattern.flags) : pattern;
      const matched = regex.test(output);
      return { output, pattern: pattern.toString(), matched };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.matched ? 1 : 0;
    });
}

export interface SimilarityOptions {
  /** Minimum similarity threshold (0-1) to score 1. Default: 0.7 */
  threshold?: number;
  /** Case-insensitive comparison (default: true) */
  ignoreCase?: boolean;
}

/**
 * Returns the string similarity score (0-1) between the output and an expected string.
 * Useful for fuzzy matching when exact equality is too strict.
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 * const scorer = checks.similarity('Sunny, 72°F');
 * ```
 */
export function similarity(expected: string, options: SimilarityOptions = {}) {
  const { ignoreCase = true } = options;
  return createScorer({
    id: 'check-similarity',
    name: 'Similarity Check',
    description: `Checks string similarity to "${expected}"`,
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      let output = run.output
        .filter(m => m.role === 'assistant')
        .map(m => getTextContentFromMastraDBMessage(m))
        .join(' ');
      let target = expected;
      if (ignoreCase) {
        output = output.toLowerCase();
        target = target.toLowerCase();
      }
      const score = stringSimilarity.compareTwoStrings(output, target);
      return { output, target, score };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.score ?? 0;
    });
}

// ─── Tool Call Checks ─────────────────────────────────────────────────────────

export interface CalledToolOptions {
  /** Minimum number of times the tool must be called. Default: 1 */
  times?: number;
}

/**
 * Scores 1 if the agent called the specified tool (at least `times` times).
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 * const scorer = checks.calledTool('get_weather');
 * const twice = checks.calledTool('search', { times: 2 });
 * ```
 */
export function calledTool(toolName: string, options: CalledToolOptions = {}) {
  const { times = 1 } = options;
  return createScorer({
    id: 'check-called-tool',
    name: 'Called Tool Check',
    description: `Checks that "${toolName}" was called${times > 1 ? ` at least ${times} times` : ''}`,
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      const { tools } = extractToolCalls(run.output);
      const count = tools.filter(t => t === toolName).length;
      return { toolName, expectedTimes: times, actualCount: count, passed: count >= times };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.passed ? 1 : 0;
    });
}

/**
 * Scores 1 if the agent did NOT call the specified tool.
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 * const scorer = checks.didNotCall('delete_user');
 * ```
 */
export function didNotCall(toolName: string) {
  return createScorer({
    id: 'check-did-not-call',
    name: 'Did Not Call Check',
    description: `Checks that "${toolName}" was NOT called`,
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      const { tools } = extractToolCalls(run.output);
      const count = tools.filter(t => t === toolName).length;
      return { toolName, count, passed: count === 0 };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.passed ? 1 : 0;
    });
}

/**
 * Scores 1 if the tools were called in the specified order (relaxed: allows other calls in between).
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 * const scorer = checks.toolOrder(['search', 'summarize', 'respond']);
 * ```
 */
export function toolOrder(expectedOrder: string[]) {
  return createScorer({
    id: 'check-tool-order',
    name: 'Tool Order Check',
    description: `Checks tool call order: [${expectedOrder.join(' → ')}]`,
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      const { tools } = extractToolCalls(run.output);
      // Check that expectedOrder appears as a subsequence of tools
      let orderIndex = 0;
      for (const tool of tools) {
        if (orderIndex < expectedOrder.length && tool === expectedOrder[orderIndex]) {
          orderIndex++;
        }
      }
      const passed = orderIndex === expectedOrder.length;
      return { actualTools: tools, expectedOrder, passed };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.passed ? 1 : 0;
    });
}

/**
 * Scores 1 if the agent used no more than `max` tool calls.
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 * const scorer = checks.maxToolCalls(5);
 * ```
 */
export function maxToolCalls(max: number) {
  return createScorer({
    id: 'check-max-tool-calls',
    name: 'Max Tool Calls Check',
    description: `Checks that no more than ${max} tool calls were made`,
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      const { tools } = extractToolCalls(run.output);
      return { count: tools.length, max, passed: tools.length <= max };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.passed ? 1 : 0;
    });
}

/**
 * Scores 1 if the agent made no tool calls at all.
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 * const scorer = checks.usedNoTools();
 * ```
 */
export function usedNoTools() {
  return createScorer({
    id: 'check-used-no-tools',
    name: 'Used No Tools Check',
    description: 'Checks that no tools were called',
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      const { tools } = extractToolCalls(run.output);
      return { count: tools.length, passed: tools.length === 0 };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.passed ? 1 : 0;
    });
}

/**
 * Scores 1 if none of the tool invocations resulted in an error state.
 * Checks for tool invocations with state other than 'result' (i.e., missing results).
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 * const scorer = checks.noToolErrors();
 * ```
 */
export function noToolErrors() {
  return createScorer({
    id: 'check-no-tool-errors',
    name: 'No Tool Errors Check',
    description: 'Checks that no tool calls resulted in errors',
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      let hasErrors = false;
      let errorCount = 0;
      let totalCalls = 0;

      for (const message of run.output) {
        const legacy = message?.content?.toolInvocations;
        const fromParts = legacy
          ? undefined
          : (message?.content as any)?.parts
              ?.filter((p: any) => p.type === 'tool-invocation')
              .map((p: any) => p.toolInvocation);
        const toolInvocations = legacy ?? fromParts;

        if (!toolInvocations?.length) continue;

        for (const invocation of toolInvocations) {
          if (!invocation) continue;
          totalCalls++;
          // A tool invocation is an error if it has state 'call' but no 'result' follow-up,
          // or if the result itself indicates an error
          if (invocation.state === 'call' || (invocation.result && invocation.result.error)) {
            hasErrors = true;
            errorCount++;
          }
        }
      }

      return { hasErrors, errorCount, totalCalls, passed: !hasErrors };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.passed ? 1 : 0;
    });
}

// ─── Convenience namespace ────────────────────────────────────────────────────

/**
 * Quick Checks — composable micro-scorers for common assertions.
 *
 * These are zero-LLM, zero-ceremony scorers that plug into the existing
 * `scorers: [...]` array anywhere scorers are used. Internally they are
 * standard `createScorer()` instances with the same observability, storage,
 * and pipeline integration as any other scorer.
 *
 * @example
 * ```ts
 * import { checks } from '@mastra/evals';
 *
 * await runEvals({
 *   data: [...],
 *   target: myAgent,
 *   scorers: [
 *     checks.includes('sunny'),
 *     checks.calledTool('get_weather'),
 *     checks.toolOrder(['search', 'summarize']),
 *     checks.noToolErrors(),
 *   ],
 * });
 * ```
 */
export const checks = {
  includes,
  excludes,
  equals,
  matches,
  similarity,
  calledTool,
  didNotCall,
  toolOrder,
  maxToolCalls,
  usedNoTools,
  noToolErrors,
};
