import stripAnsi from 'strip-ansi';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

const PROMPT = 'Summarize the plan with visible effort.';
const REPLY_TEXT = 'Two reasoning spans produced this reply.';
const REASONING_ONE = 'First reasoning span: weighing the options.';
const REASONING_TWO = 'Second reasoning span: settling on the answer.';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestBodyText(body: BodyInit | null | undefined): string {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return '';
}

type SseEvent = { type: string } & Record<string, unknown>;

function sse(events: SseEvent[]): Response {
  const body = events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function reasoningItemEvents(id: string, outputIndex: number, text: string): SseEvent[] {
  return [
    {
      type: 'response.output_item.added',
      output_index: outputIndex,
      item: { type: 'reasoning', id, summary: [] },
    },
    {
      type: 'response.reasoning_summary_part.added',
      item_id: id,
      output_index: outputIndex,
      summary_index: 0,
      part: { type: 'summary_text', text: '' },
    },
    {
      type: 'response.reasoning_summary_text.delta',
      item_id: id,
      output_index: outputIndex,
      summary_index: 0,
      delta: text,
    },
    {
      type: 'response.reasoning_summary_text.done',
      item_id: id,
      output_index: outputIndex,
      summary_index: 0,
      text,
    },
    {
      type: 'response.reasoning_summary_part.done',
      item_id: id,
      output_index: outputIndex,
      summary_index: 0,
      part: { type: 'summary_text', text },
    },
    {
      type: 'response.output_item.done',
      output_index: outputIndex,
      item: { type: 'reasoning', id, summary: [{ type: 'summary_text', text }] },
    },
  ];
}

function multiSpanReasoningResponse(): Response {
  const respId = 'resp-hidden-reasoning-single-label';
  const created = Math.floor(Date.now() / 1000);
  const model = 'gpt-5.4-mini';
  const msgId = 'msg-hidden-reasoning-single-label';

  const responseShell = (status: string, output: unknown[]) => ({
    id: respId,
    object: 'response',
    created_at: created,
    model,
    status,
    output,
  });

  const reasoningItemOne = {
    type: 'reasoning',
    id: 'rs-span-one',
    summary: [{ type: 'summary_text', text: REASONING_ONE }],
  };
  const reasoningItemTwo = {
    type: 'reasoning',
    id: 'rs-span-two',
    summary: [{ type: 'summary_text', text: REASONING_TWO }],
  };
  const msgItem = {
    type: 'message',
    id: msgId,
    status: 'completed',
    role: 'assistant',
    content: [{ type: 'output_text', text: REPLY_TEXT, annotations: [] }],
  };

  const events: SseEvent[] = [
    { type: 'response.created', response: responseShell('in_progress', []) },
    { type: 'response.in_progress', response: responseShell('in_progress', []) },
    ...reasoningItemEvents('rs-span-one', 0, REASONING_ONE),
    ...reasoningItemEvents('rs-span-two', 1, REASONING_TWO),
    {
      type: 'response.output_item.added',
      output_index: 2,
      item: { type: 'message', id: msgId, status: 'in_progress', role: 'assistant', content: [] },
    },
    {
      type: 'response.content_part.added',
      item_id: msgId,
      output_index: 2,
      content_index: 0,
      part: { type: 'output_text', text: '', annotations: [] },
    },
    {
      type: 'response.output_text.delta',
      item_id: msgId,
      output_index: 2,
      content_index: 0,
      delta: REPLY_TEXT,
    },
    {
      type: 'response.output_text.done',
      item_id: msgId,
      output_index: 2,
      content_index: 0,
      text: REPLY_TEXT,
    },
    {
      type: 'response.content_part.done',
      item_id: msgId,
      output_index: 2,
      content_index: 0,
      part: { type: 'output_text', text: REPLY_TEXT, annotations: [] },
    },
    { type: 'response.output_item.done', output_index: 2, item: msgItem },
    {
      type: 'response.completed',
      response: {
        ...responseShell('completed', [reasoningItemOne, reasoningItemTwo, msgItem]),
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      },
    },
  ];

  return sse(events);
}

export const hiddenReasoningSingleLabelScenario = {
  name: 'hidden-reasoning-single-label',
  description:
    'Render exactly one hidden Thinking... label for a response with two consecutive reasoning items, not one per span.',
  testName: 'collapses consecutive hidden reasoning spans into a single Thinking label',
  useOpenAIModel: true,
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    const patches = createGlobalPatchScope();
    const originalFetch = globalThis.fetch.bind(globalThis);
    let servedPrimary = false;
    patches.setProperty(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const isPrimary = !servedPrimary && url.includes('/responses') && requestBodyText(init?.body).includes(PROMPT);
      if (!isPrimary) return originalFetch(input, init);
      servedPrimary = true;
      // Tee the request through to AIMock so the harness's fidelity check
      // (terminal-backend-vitest-shared.ts requestCount === 0 guard) records it,
      // but serve the hand-built multi-span reasoning stream: AIMock fixtures
      // cannot emit more than one reasoning item per response.
      await originalFetch(input, init)
        .then(response => response.body?.cancel())
        .catch(() => undefined);
      return multiSpanReasoningResponse();
    });

    try {
      const app = await startMastraCodeApp({
        config: { disableHooks: true, disableMcp: true, unixSocketPubSub: false },
      });
      return { stop: () => patches.stopApp(app.stop) };
    } catch (error) {
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit(PROMPT);
    await runtime.waitForScreenText(new RegExp(REPLY_TEXT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), terminal, 15_000);

    // Counts labels in the visible viewport; the transcript here is short
    // enough that the label cannot scroll above the fold. Sample twice so a
    // late re-render adding a duplicate label is still caught.
    const countLabels = () => {
      const view = stripAnsi(terminal.serialize().view);
      return { view, count: (view.match(/Thinking\.\.\./g) ?? []).length };
    };
    const first = countLabels();
    await new Promise(resolve => setTimeout(resolve, 500));
    const second = countLabels();
    for (const sample of [first, second]) {
      if (sample.count !== 1) {
        throw new Error(
          `Expected exactly one Thinking... label for two consecutive reasoning spans, saw ${sample.count}:\n${sample.view}`,
        );
      }
    }
    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
