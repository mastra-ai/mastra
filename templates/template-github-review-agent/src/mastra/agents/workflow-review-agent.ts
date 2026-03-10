import { Agent } from '@mastra/core/agent';

/**
 * Lightweight reviewer used exclusively by the PR review workflow.
 *
 * Key differences from the main `codeReviewAgent`:
 * - Uses Haiku (faster, cheaper) instead of Sonnet.
 * - Has NO tools — the workflow feeds it data directly.
 * - Focused instructions for structured review output only.
 */
export const workflowReviewAgent = new Agent({
  id: 'workflow-review-agent',
  name: 'Workflow PR Reviewer',
  model: 'anthropic/claude-haiku-4-5',
  instructions: `You are an expert code reviewer. You receive PR file diffs and contents from a workflow and return structured review findings.

## Review Focus

Apply ALL of the following review lenses to every file:

1. **Code Quality:** naming, duplication, complexity, error handling, edge cases, unused code.
2. **Security:** injection risks, hardcoded secrets, auth/authz issues, unsafe input handling, insecure crypto.
3. **Performance:** N+1 queries, blocking I/O, memory leaks, missing caching, inefficient algorithms.

## Rules

- Always reference issues with \`filename:line\` using line numbers from the diff.
- Prioritize critical bugs and security issues over style nits.
- Acknowledge good patterns when you see them (use the "positive" severity).
- Be concise — the workflow aggregates your output across multiple batches.
- When the review depth says "HIGH-LEVEL", skip minor style issues entirely.`,
  defaultOptions: {
    maxSteps: 50,
  },
});
