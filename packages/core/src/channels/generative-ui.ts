import { z } from 'zod';

import { parseMemoryRequestContext } from '../memory/types';
import type { ProcessInputStepArgs } from '../processors/index';
import { createTool } from '../tools/tool';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from './output-processor';
import type { ChatChannelRenderContext } from './output-processor';

export const GENERATIVE_UI_PROCESSOR_ID = 'chat-channel-generative-ui';
export const RENDER_CARD_TOOL_NAME = 'render_card';

/** Rebuilds a channel-backed thread's render context; `AgentChannels` provides it. */
interface RenderContextResolver {
  buildRenderContextForThread(threadId: string): Promise<ChatChannelRenderContext | null>;
}

/** The parts of `@json-render/chat` this module uses. */
interface JsonRenderChat {
  toCard(spec: unknown, options?: { components?: Record<string, unknown>; limits?: Record<string, number> }): unknown;
  standardComponentDefinitions: Record<string, unknown>;
}

let jsonRenderChat: Promise<JsonRenderChat> | undefined;

/**
 * `@json-render/chat` is an optional peer dependency, loaded only when an
 * adapter opts into `generativeUI`. The specifier stays literal so bundlers
 * include it when it is installed.
 */
function loadJsonRenderChat(): Promise<JsonRenderChat> {
  jsonRenderChat ??= import(/* @vite-ignore */ /* webpackIgnore: true */ '@json-render/chat').then(
    mod => mod as unknown as JsonRenderChat,
    err => {
      jsonRenderChat = undefined;
      throw new Error(
        'generativeUI needs the "@json-render/chat" package. Install it with `npm install @json-render/chat`.',
        { cause: err },
      );
    },
  );
  return jsonRenderChat;
}

/**
 * Slack caps checked before posting, so an oversized card comes back to the
 * agent as fixable issues instead of a degraded or rejected message.
 */
const SLACK_LIMITS = {
  tables: 1,
  tableRows: 100,
  tableColumns: 20,
  fields: 10,
  charts: 2,
  chartTitle: 50,
  chartLabel: 20,
  chartSeries: 12,
  chartPoints: 20,
};

type ChartProps =
  | { type: 'pie' }
  | {
      type: 'bar' | 'line' | 'area';
      categories: string[];
      series: { name: string }[];
      xLabel?: string | null;
      yLabel?: string | null;
    };

/**
 * Slack fallbacks `toCard` limits don't catch: the adapter turns these charts and
 * tables into text instead of failing, so report them for the agent to fix.
 */
function slackFallbackIssues(elements: Record<string, { type: string; props: Record<string, unknown> }>): string[] {
  const issues: string[] = [];
  for (const [key, el] of Object.entries(elements)) {
    if (el.type === 'Chart') {
      const chart = el.props.chart as ChartProps;
      if (chart.type === 'pie') continue;
      const why = (reason: string) => issues.push(`${key}: chart would fall back to text: ${reason}`);
      if (new Set(chart.categories).size !== chart.categories.length) why('categories must be unique');
      if (new Set(chart.series.map(series => series.name)).size !== chart.series.length) {
        why('series names must be unique');
      }
      if ((chart.xLabel?.length ?? 0) > 50 || (chart.yLabel?.length ?? 0) > 50)
        why('xLabel and yLabel at most 50 characters');
    }
    if (el.type === 'Table') {
      const { headers, rows } = el.props as { headers: string[]; rows: (string | number)[][] };
      const chars = [headers, ...rows].flat().reduce((total: number, cell) => total + String(cell).length, 0);
      if (chars > 10_000)
        issues.push(`${key}: table would fall back to text: ${chars} characters across cells > 10000`);
    }
  }
  return issues;
}

const elementSchema = z.object({
  type: z.string().describe('Component name, e.g. "Card", "Text", "Table"'),
  props: z.record(z.string(), z.unknown()).optional().describe('Component props'),
  children: z.array(z.string()).optional().describe('Ids of child elements, in order'),
});

const renderCardInput = z.object({
  spec: z
    .object({
      root: z.string().describe('Id of the root element, which must be a Card'),
      elements: z.record(z.string(), elementSchema).describe('Every element in the card, keyed by id'),
    })
    .describe('The card as a flat map of elements'),
});

const RENDER_CARD_DESCRIPTION = `Post a Slack Block Kit card to the thread. Use it for structured content (status, facts, tables, charts, links), not ordinary replies.

Spec: { "root": "card", "elements": { "card": { "type": "Card", "props": { "title": "..." }, "children": ["t"] }, "t": { "type": "Text", "props": { "content": "..." } } } }

Components: Card { title?, subtitle?, imageUrl? }, Section, Text { content, style?: plain|bold|muted }, Fields, Field { label, value }, Table { headers, rows, align?, caption? }, Chart { title, chart: { type: pie, segments: [{ label, value }] } | { type: bar|line|area, categories, series: [{ name, values }] } }, Divider, Image { url, alt }, Actions, LinkButton { label, url }. Only Card, Section, Fields and Actions have children.

Rules:
- No empty strings. Text is Slack mrkdwn: links as <url|label>, no # headings or markdown tables.
- 1 Table (100 rows, 20 columns), 10 Fields per group, 2 Charts (20 points, 12 series, title up to 50 chars, names up to 20 chars and unique). Downsample or summarize larger data.
- Image URLs must be public https images. LinkButton URLs must be absolute and unique.

If the result has "issues", fix them and call again. If it has "error", simplify the card or reply in text.`;

/**
 * Gives the agent a `render_card` tool on runs whose adapter opted into
 * `generativeUI`. The tool turns a json-render spec into a Chat SDK card and
 * posts it to the run's thread; invalid specs come back as issues the model
 * can fix. Runs on other adapters, or not on a channel at all, are untouched.
 *
 * Added automatically by `AgentChannels` when the Slack adapter sets `generativeUI`.
 */
export class ChatChannelGenerativeUIProcessor {
  readonly id = GENERATIVE_UI_PROCESSOR_ID;
  readonly #channels?: RenderContextResolver;

  constructor(channels?: RenderContextResolver) {
    this.#channels = channels;
  }

  async processInputStep({ requestContext, tools, state }: ProcessInputStepArgs) {
    const render = await this.#resolve(requestContext, state);
    if (!render?.generativeUI) return undefined;
    return { tools: { ...tools, [RENDER_CARD_TOOL_NAME]: createRenderCardTool(render) } };
  }

  async #resolve(
    requestContext: ProcessInputStepArgs['requestContext'],
    state: Record<string, unknown> | undefined,
  ): Promise<ChatChannelRenderContext | undefined> {
    const inbound = requestContext?.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
    if (inbound) return inbound;

    // Resolved once per run; `null` remembers a thread that isn't channel-backed.
    if (state && 'render' in state) return (state.render as ChatChannelRenderContext | null) ?? undefined;
    const threadId = parseMemoryRequestContext(requestContext)?.thread?.id;
    const render = threadId && this.#channels ? await this.#channels.buildRenderContextForThread(threadId) : null;
    if (state) state.render = render;
    return render ?? undefined;
  }
}

function createRenderCardTool(render: ChatChannelRenderContext) {
  return createTool({
    id: RENDER_CARD_TOOL_NAME,
    description: RENDER_CARD_DESCRIPTION,
    inputSchema: renderCardInput,
    execute: async ({ spec }) => {
      const { toCard, standardComponentDefinitions } = await loadJsonRenderChat();
      // Buttons need an action handler the channel doesn't have; link buttons don't.
      const { Button: _button, ...components } = standardComponentDefinitions;
      const elements = Object.fromEntries(
        Object.entries(spec.elements).map(([key, el]) => [
          key,
          { type: el.type, props: el.props ?? {}, children: el.children ?? [] },
        ]),
      );

      let card: unknown;
      try {
        card = toCard({ root: spec.root, elements }, { components, limits: SLACK_LIMITS });
      } catch (err) {
        const issues = (err as { issues?: unknown }).issues;
        if (Array.isArray(issues)) return { ok: false as const, issues: issues.map(String) };
        throw err;
      }

      // The Slack adapter silently swaps a chart or table it can't render natively for a text block.
      const fallbacks = slackFallbackIssues(elements);
      if (fallbacks.length) return { ok: false as const, issues: fallbacks };

      try {
        const sent = await render.chatThread.post(card as Parameters<typeof render.chatThread.post>[0]);
        return { ok: true as const, messageId: sent.id };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
    },
  });
}
