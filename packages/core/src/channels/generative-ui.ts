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
  slack: { tables: 1, tableRows: 100, fields: 10 },
};

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

Components:
- Card { title?, subtitle?, imageUrl? }: the root; holds any children.
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

Keep cards small: one Table per card, at most 10 Fields per Fields group. If the result has "issues", fix the spec and call again.`;

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

      try {
        const sent = await render.chatThread.post(card as Parameters<typeof render.chatThread.post>[0]);
        return { ok: true as const, messageId: sent.id };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
    },
  });
}
