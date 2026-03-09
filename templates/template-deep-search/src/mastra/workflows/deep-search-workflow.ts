import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import Exa from 'exa-js';

const stateSchema = z.object({
  initialQuery: z.string().optional(),
  clarifiedIntent: z.string().optional(),
  expandedQueries: z.array(z.string()).optional(),
  searchResults: z
    .array(
      z.object({
        query: z.string(),
        results: z.array(
          z.object({
            title: z.string().nullable(),
            url: z.string(),
            summary: z.string(),
            publishedDate: z.string().optional(),
            author: z.string().nullable().optional(),
          }),
        ),
      }),
    )
    .optional(),
  gaps: z.array(z.string()).optional(),
  answerIsSatisfactory: z.boolean().optional(),
  answer: z.string().optional(),
});

const clarifyIntent = createStep({
  id: 'clarify-intent',
  inputSchema: z.object({ initialQuery: z.string() }),
  outputSchema: z.object({}),
  stateSchema,
  resumeSchema: z.object({ clarifiedIntent: z.string() }),
  suspendSchema: z.object({ assistantMessage: z.string() }),
  execute: async ({ inputData, resumeData, suspend, setState, mastra }) => {
    const log = mastra.getLogger();

    if (!resumeData) {
      log.info('clarifyIntent start', {
        step: 'clarifyIntent',
        initialQuery: inputData.initialQuery,
      });
      await setState({ initialQuery: inputData.initialQuery });

      const intentAgent = mastra.getAgent('intentClarifierAgent');
      const response = await intentAgent.generate(
        `User query: "${inputData.initialQuery}"\n\nGenerate exactly 3 clarifying questions to better understand the user's intent.`,
        {
          structuredOutput: {
            schema: z.object({ questions: z.array(z.string()).length(3) }),
          },
        },
      );

      const questions = response.object.questions;
      const formatted = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
      const assistantMessage = `To help you better, I have a few questions:\n\n${formatted}`;

      log.info('clarifyIntent suspend', {
        step: 'clarifyIntent',
        questionCount: questions.length,
        assistantMessage,
      });
      return suspend({ assistantMessage });
    }

    log.info('clarifyIntent resume', {
      step: 'clarifyIntent',
      clarifiedIntent: resumeData.clarifiedIntent,
    });
    await setState({
      initialQuery: inputData.initialQuery,
      clarifiedIntent: resumeData.clarifiedIntent,
    });
    return {};
  },
});

const generateQueries = createStep({
  id: 'generate-queries',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  stateSchema,
  execute: async ({ state, setState, mastra }) => {
    const log = mastra.getLogger();
    log.info('generateQueries start', {
      step: 'generateQueries',
      initialQuery: state.initialQuery,
      clarifiedIntent: state.clarifiedIntent,
      gaps: state.gaps?.length ?? 0,
    });

    const priorQueries = state.searchResults?.map(r => r.query) ?? [];
    const uniquePrior = [...new Set(priorQueries)];

    const priorText =
      uniquePrior.length > 0 ? `\nPrevious queries (avoid repeating):\n- ${uniquePrior.join('\n- ')}` : '';

    const gapsText = state.gaps?.length ? `\nKnown gaps:\n- ${state.gaps.join('\n- ')}` : '';

    const plannerAgent = mastra.getAgent('researchPlannerAgent');
    const response = await plannerAgent.generate(
      `User initial query: "${state.initialQuery}"
Additional context: "${state.clarifiedIntent}"
${priorText}
${gapsText}

Generate 3-5 focused search queries.`,
      {
        structuredOutput: {
          schema: z.object({ queries: z.array(z.string()).min(3).max(5) }),
        },
      },
    );

    const expandedQueries = response.object.queries;
    log.info('generateQueries state update', {
      step: 'generateQueries',
      expandedQueries,
    });

    await setState({ ...state, expandedQueries });
    return {};
  },
});

const search = createStep({
  id: 'search',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  stateSchema,
  execute: async ({ state, setState, mastra }) => {
    const log = mastra.getLogger();
    log.info('search start', {
      step: 'search',
      queryCount: state.expandedQueries!.length,
    });

    const exa = new Exa(process.env.EXA_API_KEY);
    const previousResults = state.searchResults ?? [];

    const searchResults = await Promise.all(
      state.expandedQueries!.map(async query => {
        log.info('search query start', { step: 'search', query });

        const response = await exa.search(query, {
          numResults: 10,
          contents: { summary: true },
        });

        log.info('search query done', {
          step: 'search',
          query,
          results: response.results.length,
        });

        return {
          query,
          results: response.results.map(r => ({
            title: r.title,
            url: r.url,
            summary: r.summary,
            publishedDate: r.publishedDate,
            author: r.author,
          })),
        };
      }),
    );

    log.info('search state update', {
      step: 'search',
      queriesSearched: previousResults.length + searchResults.length,
    });

    await setState({
      ...state,
      searchResults: [...previousResults, ...searchResults],
    });
    return {};
  },
});

const evaluateResults = createStep({
  id: 'evaluate-results',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  stateSchema,
  execute: async ({ state, setState, mastra }) => {
    const log = mastra.getLogger();
    log.info('evaluateResults start', {
      step: 'evaluateResults',
      queriesSearched: state.searchResults?.length ?? 0,
    });

    const evaluatorAgent = mastra.getAgent('searchResultEvaluatorAgent');
    const response = await evaluatorAgent.generate(
      `User query: "${state.initialQuery}"
Clarified intent: "${state.clarifiedIntent}"
Search results:
${JSON.stringify(state.searchResults, null, 2)}

Determine if the results are sufficient.`,
      {
        structuredOutput: {
          schema: z.object({
            answerIsSatisfactory: z.boolean(),
            gaps: z.array(z.string()),
          }),
        },
      },
    );

    const { answerIsSatisfactory, gaps } = response.object;
    log.info('evaluateResults state update', {
      step: 'evaluateResults',
      answerIsSatisfactory,
      gaps,
    });

    await setState({
      ...state,
      answerIsSatisfactory,
      gaps,
    });
    return {};
  },
});

const finalizeAnswer = createStep({
  id: 'finalize-answer',
  inputSchema: z.object({}),
  outputSchema: z.object({ answer: z.string() }),
  stateSchema,
  execute: async ({ state, mastra }) => {
    const log = mastra.getLogger();
    const queries = state.searchResults?.map(r => r.query);
    log.info('finalizeAnswer queries', { step: 'finalizeAnswer', queries });

    const exhausted = !state.answerIsSatisfactory;
    log.info('finalizeAnswer exhausted', { step: 'finalizeAnswer', exhausted });

    const answerAgent = mastra.getAgent('answererAgent');
    const exhaustionNote = exhausted
      ? 'Note: We may not have all the information needed. Please provide your best attempt based on available information.\n'
      : '';

    const stream = await answerAgent.stream(
      `Query: "${state.initialQuery}"
Clarified needs: "${state.clarifiedIntent}"
${exhaustionNote}
Based on the following search results, answer the user's question:
${JSON.stringify(state.searchResults, null, 2)}`,
    );

    const answer = await stream.text;
    log.info('finalizeAnswer output', { step: 'finalizeAnswer', answer });

    return { answer };
  },
});

const searchPass = createWorkflow({
  id: 'search-pass',
  inputSchema: z.object({}),
  outputSchema: z.object({
    answerIsSatisfactory: z.boolean(),
    gaps: z.array(z.string()),
  }),
  stateSchema,
})
  .then(generateQueries)
  .then(search)
  .then(evaluateResults)
  .commit();

const deepSearch = createWorkflow({
  id: 'deep-search',
  inputSchema: z.object({ initialQuery: z.string() }),
  outputSchema: z.object({ answer: z.string() }),
  stateSchema,
})
  .then(clarifyIntent)
  .dountil(searchPass, async ({ iterationCount, state }) => {
    return iterationCount >= 4 || !!state.answerIsSatisfactory;
  })
  .then(finalizeAnswer)
  .commit();

export { deepSearch };
