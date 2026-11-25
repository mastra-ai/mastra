import type { Scenario, ScenarioStep } from '../scenario.js';
import { errorMessage, makeStep, probeTool, requireTools } from '../scenario.js';

/**
 * Exa scenario. Exa bills every search, contents, and answer call, so nothing
 * here spends credits unless `MASTRA_SMOKE_EXA_ALLOW_BILLED=1`.
 *
 * - Unset, each tool is sent a blank query or id, which Exa refuses before
 *   doing any work. That still proves routing, auth, and serialization.
 * - With it, the scenario searches the web, reads the first result's contents,
 *   and answers a question with citations, asking for as few results and as
 *   little text as the checks need. When search fails, the contents read uses
 *   https://mastra.ai.
 *
 * Every Exa tool is a read, so the scenario creates nothing and has nothing to
 * clean up.
 */

const EXA_TOOLS = ['exa_search', 'exa_get_contents', 'exa_answer'] as const;

const SEED_URL = 'https://mastra.ai';

interface ExaResult {
  id: string;
  url?: string | null;
  title?: string | null;
  text?: string;
  highlights?: string[];
}

export const exaScenario: Scenario = {
  integrationId: 'exa',
  summary: 'search → get contents → answer',
  async run({ tools, call }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, EXA_TOOLS);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    if (process.env.MASTRA_SMOKE_EXA_ALLOW_BILLED !== '1') {
      steps.push(await probeTool(call, tools, 'search (probe)', 'exa_search', { query: ' ' }));
      steps.push(await probeTool(call, tools, 'get contents (probe)', 'exa_get_contents', { ids: [''], text: {} }));
      steps.push(await probeTool(call, tools, 'answer (probe)', 'exa_answer', { query: '' }));
      return steps;
    }

    let seed = SEED_URL;
    try {
      const result = await call<{ results: ExaResult[] }>('exa_search', {
        query: 'Mastra TypeScript AI agent framework',
        numResults: 2,
        text: { maxCharacters: 200 },
      });
      const first = result.results[0];
      if (!first) throw new Error('search returned no results');
      seed = first.url ?? first.id;
      steps.push(makeStep('search', 'exa_search', 'pass', `${result.results.length} result(s), first ${seed}`));
    } catch (error) {
      steps.push(makeStep('search', 'exa_search', 'fail', errorMessage(error)));
    }

    try {
      const result = await call<{ results: ExaResult[]; statuses: Array<{ id: string; status: string }> }>(
        'exa_get_contents',
        { ids: [seed], text: { maxCharacters: 500 }, highlights: { numSentences: 1, highlightsPerUrl: 1 } },
      );
      const page = result.results[0];
      if (!page?.text) throw new Error(`no text for ${seed}: ${JSON.stringify(result.statuses)}`);
      steps.push(makeStep('get contents', 'exa_get_contents', 'pass', `${page.text.length} chars of ${seed}`));
    } catch (error) {
      steps.push(makeStep('get contents', 'exa_get_contents', 'fail', errorMessage(error)));
    }

    try {
      const result = await call<{ answer: string; citations: ExaResult[] }>('exa_answer', {
        query: 'What programming language is the Mastra AI agent framework written in?',
      });
      if (!result.answer) throw new Error('empty answer');
      steps.push(makeStep('answer', 'exa_answer', 'pass', `${result.citations.length} citation(s)`));
    } catch (error) {
      steps.push(makeStep('answer', 'exa_answer', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
