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
 * Platform caps checked before posting, so an oversized card comes back to the
 * agent as fixable issues instead of a platform API error.
 */
const PLATFORM_LIMITS: Record<string, Record<string, number>> = {
  slack: {
    tables: 1,
    tableRows: 100,
    tableColumns: 20,
    fields: 10,
    charts: 2,
    chartTitle: 50,
    chartLabel: 20,
    chartSeries: 12,
    chartPoints: 20,
  },
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

const RENDER_CARD_DESCRIPTION = `Post a card to the current chat thread, shown as native UI (Block Kit on Slack).
Use it for structured content that reads better as a card than as text: status summaries, key/value facts, tables, charts, links. Don't use it for ordinary conversational replies.

The spec is a flat element map: { "root": "card", "elements": { "card": { "type": "Card", "props": { "title": "..." }, "children": ["facts"] }, "facts": { ... } } }. The root must be a Card. "children" lists child element ids.

Components (use only these, with only these props):
- Card { title?, subtitle?, imageUrl? }: the root; holds any children. title is plain text, at most 150 chars.
- Section {}: groups children.
- Text { content (markdown), style?: "plain" | "bold" | "muted" }
- Fields {}: a grid of Field children.
- Field { label, value: string | number }
- Table { headers: string[], rows: (string | number)[][], align?: ("left" | "center" | "right")[], caption? }: one cell per header; right-align numbers.
- Chart { title, chart: { type: "pie", segments: [{ label, value > 0 }] } | { type: "bar" | "line" | "area", categories: string[], series: [{ name, values: number[] }], xLabel?, yLabel? } }
- Divider {}
- Image { url (https), alt }
- Actions {}: a row of LinkButton children.
- LinkButton { label, url }

Rules that keep the card valid Block Kit (Slack rejects the whole message otherwise):
- Every element id in "children" must exist in "elements", and every element except the root must be someone's child. Only Card, Section, Fields and Actions take children.
- No empty strings: Text content, Field label/value, Table headers and cells, Chart title and labels, Image alt and LinkButton label all need text. Use "-" for a blank cell.
- Text content uses Slack mrkdwn: **bold**, _italic_, \`code\`, links as <https://example.com|label>, "- " bullets. No headings (#), markdown tables, [label](url) links or images in text; use Card title, Table, LinkButton and Image instead. Keep each Text under 3000 chars.
- Fields: at most 10 per Fields group; keep each label + value under 2000 chars.
- Table: at most one per card, 100 rows (header included), 20 columns, about 10,000 chars across all cells. Split bigger data or summarize it.
- Chart: at most 2 per card; title 1-50 chars; xLabel/yLabel at most 50 chars; labels, category names and series names 1-20 chars and unique; up to 12 series or pie segments and 20 categories (points); every series has one value per category. Fit the data before calling: downsample long ranges (e.g. 31 days to weekly or the last 20 days) and shorten names ("Factory", not "Factory (mastra-platform[bot])"). Charts that break these come back as issues instead of posting.
- Image and Card imageUrl: a public https URL that points directly at a PNG, JPG or GIF. Slack fetches it, so never use private, localhost, auth-gated or made-up URLs.
- LinkButton: absolute http(s) URL, label at most 75 chars, at most 25 per Actions row, and no two buttons with the same URL in one card.
- Keep the whole card under 50 blocks; prefer a few focused elements over many.

If the result has "issues", fix the spec and call again. If it has "error" (for example invalid_blocks), Slack rejected the card: simplify it (drop images, shorten text, remove the element most likely at fault) and retry once, or fall back to a plain text reply.`;

/**
 * Gives the agent a `render_card` tool on runs whose adapter opted into
 * `generativeUI`. The tool turns a json-render spec into a Chat SDK card and
 * posts it to the run's thread; invalid specs come back as issues the model
 * can fix. Runs on other adapters, or not on a channel at all, are untouched.
 *
 * Added automatically by `AgentChannels` when any adapter sets `generativeUI`.
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
        card = toCard({ root: spec.root, elements }, { components, limits: PLATFORM_LIMITS[render.platform] });
      } catch (err) {
        const issues = (err as { issues?: unknown }).issues;
        if (Array.isArray(issues)) return { ok: false as const, issues: issues.map(String) };
        throw err;
      }

      // The Slack adapter silently swaps a chart or table it can't render natively for a text block.
      const fallbacks = render.platform === 'slack' ? slackFallbackIssues(elements) : [];
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
