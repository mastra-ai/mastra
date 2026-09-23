/**
 * Tools that reach outside the fixture.
 *
 * Everything in `support-tools.ts` reads a fixed dataset, which is what makes
 * the workshop reproducible. These do the opposite on purpose: they go to the
 * live internet, and they exist because an agent that can only answer from
 * canned data is a demo, while an agent that can look something up is a thing
 * somebody would actually deploy.
 *
 * Three, and the split matters when the Builder is choosing between them:
 *
 *   webSearch  answer a question from the live web, with citations
 *   webFetch   read one specific URL the user already named
 *   askUser    stop and ask a human, then continue with their answer
 *
 * `webSearch` is not deterministic and never will be — the web changes. Keep
 * it out of anything that gates CI. It belongs to the Builder half of this
 * example, not the twelve exercises.
 */
import { askUserTool, webFetchTool } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Why this is hand-rolled rather than Mastra's `webSearchTool`.
 *
 * `@mastra/core/tools` exports a `webSearchTool`, and for a code-defined agent
 * it is the right answer: one import, and Mastra swaps in whichever native
 * search the active model provides. But it is a *placeholder symbol*, not a
 * `ToolAction` — it has no id, no description and no schema until an agent run
 * resolves it against a model. The Mastra instance registry is typed
 * `Record<string, ToolAction>`, and the Agent Builder's picker renders from
 * exactly that registry, so a placeholder cannot appear there and cannot be
 * written into a stored agent's tool list.
 *
 * So: a real tool that calls OpenAI's Responses API with its built-in
 * `web_search`. It shows up in the picker, it serialises into a stored agent,
 * and it returns citations as data rather than as prose the model has to be
 * trusted to copy accurately.
 *
 * Use `webSearchTool` instead when you are writing the agent in code and no
 * one needs to pick it from a list.
 */

const SEARCH_MODEL = process.env.WEB_SEARCH_MODEL ?? 'gpt-5-mini';
const SEARCH_TIMEOUT_MS = 60_000;

type ResponsesOutputItem = {
  type: string;
  action?: { type?: string; query?: string; queries?: string[] };
  content?: Array<{
    text?: string;
    annotations?: Array<{ type?: string; title?: string; url?: string }>;
  }>;
};

export const webSearch = createTool({
  id: 'webSearch',
  description:
    'Search the live web and return a short synthesised answer with source links. Use for anything time-sensitive, external, or not covered by internal documentation — competitor information, current events, third-party product details, prices, public status pages.',
  inputSchema: z.object({
    query: z.string().describe('What to find out, phrased as a question or a topic'),
    depth: z
      .enum(['low', 'medium', 'high'])
      .default('medium')
      .describe('How much of the web to read before answering. Higher is slower and more thorough.'),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    answer: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string() })),
    searchedFor: z.array(z.string()),
    error: z.string().nullable(),
  }),
  execute: async ({ query, depth }) => {
    const empty = { answer: '', sources: [], searchedFor: [] };

    if (!process.env.OPENAI_API_KEY) {
      return {
        ok: false,
        ...empty,
        error: 'No OPENAI_API_KEY is configured, so web search is unavailable. Say so rather than guessing an answer.',
      };
    }

    // A timeout, because a hung search in front of an audience is worse than
    // a failed one. The tool reports the failure; the agent explains it.
    const abort = AbortSignal.timeout(SEARCH_TIMEOUT_MS);

    let payload: { output?: ResponsesOutputItem[]; error?: { message?: string } };
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: abort,
        headers: {
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: SEARCH_MODEL,
          input: query,
          tools: [{ type: 'web_search', search_context_size: depth }],
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        return { ok: false, ...empty, error: `Web search failed: ${response.status} ${detail.slice(0, 200)}` };
      }
      payload = await response.json();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, ...empty, error: `Web search failed: ${reason}` };
    }

    if (payload.error?.message) {
      return { ok: false, ...empty, error: `Web search failed: ${payload.error.message}` };
    }

    // The Responses API returns a flat `output` array mixing reasoning items,
    // one `web_search_call` per search, and the final `message`. Pull the
    // answer text out of the message and the citations off its annotations —
    // OpenAI hands them back as structured `url_citation` objects, which is
    // the whole reason to prefer this over scraping links out of prose.
    const items = payload.output ?? [];
    const answer = items
      .filter(item => item.type === 'message')
      .flatMap(item => item.content ?? [])
      .map(part => part.text ?? '')
      .join('\n')
      .trim();

    const seen = new Set<string>();
    const sources = items
      .filter(item => item.type === 'message')
      .flatMap(item => item.content ?? [])
      .flatMap(part => part.annotations ?? [])
      .filter(a => a.type === 'url_citation' && a.url)
      .filter(a => (seen.has(a.url!) ? false : (seen.add(a.url!), true)))
      .map(a => ({ title: a.title ?? a.url!, url: a.url! }));

    const searchedFor = items
      .filter(item => item.type === 'web_search_call')
      .flatMap(item => item.action?.queries ?? (item.action?.query ? [item.action.query] : []));

    return { ok: true, answer, sources, searchedFor, error: null };
  },
});

/**
 * Read one page the user already named.
 *
 * Mastra's built-in, re-exported under a friendlier key. Worth knowing what it
 * refuses: non-HTTP schemes, `localhost`, and private or reserved IP ranges —
 * including addresses that only resolve to one after DNS. An agent that any
 * customer can talk to should not be a way to probe your internal network, and
 * this is the guard that stops it. Responses truncate at 100,000 characters.
 */
export const webFetch = webFetchTool;

/**
 * Stop and ask a person.
 *
 * The tool that most changes what a non-engineer can safely build. Without it
 * an agent guesses when a request is ambiguous; with it the run suspends, the
 * question is rendered in the chat, and the answer resumes the same run. Give
 * it `options` and the host renders choices rather than a text box.
 *
 * Attach it to anything that would otherwise have to assume — and note the
 * trade: an agent that can ask is no longer fully autonomous, so it is a poor
 * fit for scheduled or batch work where nobody is watching.
 */
export const askUser = askUserTool;

/** Everything above, ready to spread into `new Mastra({ tools })`. */
export const webTools = { webSearch, webFetch, askUser };
