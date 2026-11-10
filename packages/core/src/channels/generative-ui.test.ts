import { describe, it, expect, vi } from 'vitest';

import type { ProcessInputStepArgs } from '../processors/index';
import { RequestContext } from '../request-context';
import { ChatChannelGenerativeUIProcessor, RENDER_CARD_TOOL_NAME } from './generative-ui';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from './output-processor';
import type { ChatChannelRenderContext } from './output-processor';

function renderContext(overrides: Partial<ChatChannelRenderContext> = {}) {
  const post = vi.fn(async (_card: unknown) => ({ id: 'msg-1' }));
  const render = {
    platform: 'slack',
    generativeUI: true,
    chatThread: { id: 'slack:C1:1.1', post },
    ...overrides,
  } as unknown as ChatChannelRenderContext;
  return { render, post };
}

function args(opts: { render?: ChatChannelRenderContext; tools?: Record<string, unknown>; threadId?: string }) {
  const requestContext = new RequestContext();
  if (opts.render) requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, opts.render);
  if (opts.threadId) requestContext.set('MastraMemory', { thread: { id: opts.threadId } });
  return { requestContext, tools: opts.tools ?? {}, state: {} } as unknown as ProcessInputStepArgs;
}

async function renderCard(render: ChatChannelRenderContext, spec: unknown) {
  const result = await new ChatChannelGenerativeUIProcessor().processInputStep(args({ render }));
  const tool = result!.tools[RENDER_CARD_TOOL_NAME] as { execute: (input: unknown, ctx: unknown) => Promise<any> };
  return tool.execute({ spec }, {});
}

const statusSpec = {
  root: 'card',
  elements: {
    card: { type: 'Card', props: { title: 'Deploy status' }, children: ['facts', 'table', 'links'] },
    facts: { type: 'Fields', children: ['env'] },
    env: { type: 'Field', props: { label: 'Env', value: 'beta' } },
    table: { type: 'Table', props: { headers: ['Service', 'p95'], rows: [['api', 120]] } },
    links: { type: 'Actions', children: ['open'] },
    open: { type: 'LinkButton', props: { label: 'Open', url: 'https://example.com' } },
  },
};

describe('ChatChannelGenerativeUIProcessor', () => {
  it('adds render_card next to existing tools when the adapter opted in', async () => {
    const { render } = renderContext();
    const existing = { other: {} };
    const result = await new ChatChannelGenerativeUIProcessor().processInputStep(args({ render, tools: existing }));
    expect(Object.keys(result!.tools)).toEqual(['other', RENDER_CARD_TOOL_NAME]);
  });

  it('leaves runs alone when the adapter did not opt in', async () => {
    const { render } = renderContext({ generativeUI: undefined });
    expect(await new ChatChannelGenerativeUIProcessor().processInputStep(args({ render }))).toBeUndefined();
  });

  it('leaves runs that are not on a channel alone', async () => {
    expect(await new ChatChannelGenerativeUIProcessor().processInputStep(args({}))).toBeUndefined();
  });

  it('rebuilds the render context from the memory thread for runs not started by a message', async () => {
    const { render } = renderContext();
    const buildRenderContextForThread = vi.fn(async () => render);
    const processor = new ChatChannelGenerativeUIProcessor({ buildRenderContextForThread });
    const stepArgs = args({ threadId: 'thread-1' });

    expect((await processor.processInputStep(stepArgs))!.tools).toHaveProperty(RENDER_CARD_TOOL_NAME);
    await processor.processInputStep(stepArgs);
    expect(buildRenderContextForThread).toHaveBeenCalledTimes(1);
    expect(buildRenderContextForThread).toHaveBeenCalledWith('thread-1');
  });

  it('posts a valid spec to the thread as a Chat SDK card', async () => {
    const { render, post } = renderContext();
    const result = await renderCard(render, statusSpec);

    expect(result).toEqual({ ok: true, messageId: 'msg-1' });
    const card = post.mock.calls[0]![0] as { type: string; title: string; children: { type: string }[] };
    expect(card.type).toBe('card');
    expect(card.title).toBe('Deploy status');
    expect(card.children.map(child => child.type)).toEqual(['fields', 'table', 'actions']);
  });

  it('returns spec issues to the model instead of posting', async () => {
    const { render, post } = renderContext();
    const result = await renderCard(render, {
      root: 'card',
      elements: {
        card: { type: 'Card', children: ['x', 'b'] },
        x: { type: 'Nope' },
        b: { type: 'Button', props: { id: 'go', label: 'Go' } },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.stringContaining('Nope')]));
    expect(result.issues).toEqual(expect.arrayContaining([expect.stringContaining('Button')]));
    expect(post).not.toHaveBeenCalled();
  });

  it('enforces Slack limits before posting', async () => {
    const { render, post } = renderContext();
    const table = { type: 'Table', props: { headers: ['a'], rows: [['1']] } };
    const result = await renderCard(render, {
      root: 'card',
      elements: { card: { type: 'Card', children: ['t1', 't2'] }, t1: table, t2: table },
    });

    expect(result.ok).toBe(false);
    expect(result.issues.join('\n')).toContain('Table');
    expect(post).not.toHaveBeenCalled();
  });

  it('enforces Slack chart limits before posting', async () => {
    const { render, post } = renderContext();
    const result = await renderCard(render, {
      root: 'card',
      elements: {
        card: { type: 'Card', children: ['chart'] },
        chart: {
          type: 'Chart',
          props: {
            title: 'x'.repeat(51),
            chart: { type: 'bar', categories: ['a much longer category name'], series: [{ name: 's', values: [1] }] },
          },
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues.join('\n')).toContain('50 characters');
    expect(result.issues.join('\n')).toContain('20 characters');
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a line chart Slack would silently render as a text table', async () => {
    const { render, post } = renderContext();
    const days = Array.from({ length: 31 }, (_, i) => `Day ${i + 1}`);
    const result = await renderCard(render, {
      root: 'card',
      elements: {
        card: { type: 'Card', children: ['chart'] },
        chart: {
          type: 'Chart',
          props: {
            title: 'Daily velocity',
            chart: {
              type: 'line',
              categories: days,
              series: [{ name: 'Factory (mastra-platform[bot])', values: days.map(() => 1) }],
            },
          },
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues.join('\n')).toContain('at most 20 categories');
    expect(result.issues.join('\n')).toContain('"Factory (mastra-platform[bot])" longer than 20 characters');
    expect(post).not.toHaveBeenCalled();
  });

  it('reports other Slack text fallbacks as issues', async () => {
    const { render, post } = renderContext();
    const result = await renderCard(render, {
      root: 'card',
      elements: {
        card: { type: 'Card', children: ['chart', 'table'] },
        chart: {
          type: 'Chart',
          props: {
            title: 'Deploys',
            chart: {
              type: 'bar',
              categories: ['Mon', 'Mon'],
              series: [
                { name: 'web', values: [1, 2] },
                { name: 'web', values: [3, 4] },
              ],
              yLabel: 'y'.repeat(51),
            },
          },
        },
        table: { type: 'Table', props: { headers: ['a'], rows: [['x'.repeat(10_001)]] } },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      'chart: chart would fall back to text: categories must be unique',
      'chart: chart would fall back to text: series names must be unique',
      'chart: chart would fall back to text: xLabel and yLabel at most 50 characters',
      'table: table would fall back to text: 10002 characters across cells > 10000',
    ]);
    expect(post).not.toHaveBeenCalled();
  });

  it('reports a failed post to the model', async () => {
    const { render, post } = renderContext();
    post.mockRejectedValueOnce(new Error('invalid_blocks'));
    expect(await renderCard(render, statusSpec)).toEqual({ ok: false, error: 'invalid_blocks' });
  });
});
