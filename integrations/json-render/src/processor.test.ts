import { buildSpecFromParts } from '@json-render/react';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { chat, modelSaw, modelWriting, specBlock, weatherCard } from './__tests__/test-utils';

describe('JsonRenderProcessor', () => {
  it('streams the spec the model writes as data-spec parts and keeps only the prose as text', async () => {
    const { model } = modelWriting(`Here is the weather.\n${specBlock(weatherCard)}\nEnjoy!`);

    const { streamed, messages } = await chat(model, 'Weather in Paris?');

    const text = streamed.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.payload.text);
    expect(text.join('')).toBe('Here is the weather.\nEnjoy!');
    expect(buildSpecFromParts(streamed as any)).toEqual(weatherCard);

    const reply = messages.find(message => message.role === 'assistant')!;
    const parts = reply.content.parts as { type: string; text?: string }[];
    expect(
      parts
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join(''),
    ).toBe('Here is the weather.\nEnjoy!');
    expect(buildSpecFromParts(parts as any)).toEqual(weatherCard);
  });

  it.each([
    { ending: 'inline code', reply: 'Use `x`' },
    { ending: 'a closing code fence', reply: 'Run this:\n```bash\nnpm test\n```' },
    { ending: 'a line starting with {', reply: 'The config is:\n{"a": 1}' },
    { ending: 'braces inside a line', reply: 'The config is {"a": 1}' },
  ])('keeps a reply that ends in $ending, with no newline after it', async ({ reply }) => {
    const { model } = modelWriting(reply);

    const { streamed, messages } = await chat(model, 'Hi');

    const text = streamed.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.payload.text);
    expect(text.join('')).toBe(reply);
    const types = streamed.map(chunk => chunk.type);
    expect(types.lastIndexOf('text-end')).toBeGreaterThan(types.lastIndexOf('text-delta'));
    const saved = messages.find(message => message.role === 'assistant')!.content.parts as {
      type: string;
      text?: string;
    }[];
    expect(
      saved
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join(''),
    ).toBe(reply);
  });

  it.each([
    {
      problem: 'a child that does not exist',
      spec: { root: 'card', elements: { card: { type: 'Card', props: { title: 'Paris' }, children: ['forecast'] } } },
      mentions: 'forecast',
    },
    {
      problem: 'props the component does not take',
      spec: { root: 'card', elements: { card: { type: 'Card', props: { title: 18 }, children: [] } } },
      mentions: 'title',
    },
    {
      problem: 'a component the catalog does not have',
      spec: { root: 'card', elements: { card: { type: 'Chart', props: {}, children: [] } } },
      mentions: 'Chart',
    },
    {
      problem: 'a list whose repeat key is not unique',
      spec: {
        root: 'card',
        state: { days: [{ name: 'Mon' }, { name: 'Mon' }] },
        elements: {
          card: {
            type: 'Card',
            props: { title: 'Week' },
            repeat: { statePath: '/days', key: 'name' },
            children: ['day'],
          },
          day: { type: 'Text', props: { text: { $item: 'name' } }, children: [] },
        },
      },
      mentions: 'more than once',
    },
  ])('sends a spec with $problem back to the model and keeps the one it writes instead', async ({ spec, mentions }) => {
    const { model, prompts } = modelWriting(`Here.\n${specBlock(spec)}`, `Here.\n${specBlock(weatherCard)}`);

    const { messages } = await chat(model, 'Weather in Paris?');

    expect(JSON.stringify(prompts[1])).toContain(mentions);
    const replies = messages.filter(message => message.role === 'assistant');
    expect(replies.map(reply => buildSpecFromParts(reply.content.parts as any))).toEqual([weatherCard]);
  });

  it('keeps a spec whose props are bound to state, checking them by the value they resolve to', async () => {
    const bound = {
      root: 'card',
      state: { city: 'Paris' },
      elements: { card: { type: 'Card', props: { title: { $state: '/city' } }, children: [] } },
    };
    const { model, prompts } = modelWriting(`Here.\n${specBlock(bound)}`);

    const { messages } = await chat(model, 'Weather in Paris?');

    expect(prompts).toHaveLength(1);
    const reply = messages.find(message => message.role === 'assistant')!;
    expect(buildSpecFromParts(reply.content.parts as any)).toEqual(bound);
  });

  it('keeps a spec that repeats children over a state list, checking them by each item', async () => {
    const days = {
      root: 'card',
      state: { days: [{ name: 'Monday' }, { name: 'Tuesday' }] },
      elements: {
        card: { type: 'Card', props: { title: 'Week' }, repeat: { statePath: '/days' }, children: ['day'] },
        day: { type: 'Text', props: { text: { $item: 'name' } }, children: [] },
      },
    };
    const { model, prompts } = modelWriting(`Here.\n${specBlock(days)}`);

    const { messages } = await chat(model, 'My week?');

    expect(prompts).toHaveLength(1);
    const reply = messages.find(message => message.role === 'assistant')!;
    expect(buildSpecFromParts(reply.content.parts as any)).toEqual(days);
  });

  it('sends back a repeated child whose item does not have what it binds', async () => {
    const days = {
      root: 'card',
      state: { days: [{ name: 'Monday' }, { label: 'Tuesday' }] },
      elements: {
        card: { type: 'Card', props: { title: 'Week' }, repeat: { statePath: '/days' }, children: ['day'] },
        day: { type: 'Text', props: { text: { $item: 'name' } }, children: [] },
      },
    };
    const { model, prompts } = modelWriting(`Here.\n${specBlock(days)}`, `Here.\n${specBlock(weatherCard)}`);

    await chat(model, 'My week?');

    expect(prompts).toHaveLength(2);
    expect(JSON.stringify(prompts[1])).toContain('\\"day\\" (Text) prop \\"text\\"');
  });

  it('saves a list streamed one item at a time exactly as the model wrote it', async () => {
    const lines = [
      { op: 'add', path: '/root', value: 'card' },
      {
        op: 'add',
        path: '/elements/card',
        value: {
          type: 'Card',
          props: { title: 'Week' },
          repeat: { statePath: '/days', key: 'name' },
          children: ['day'],
        },
      },
      { op: 'add', path: '/elements/day', value: { type: 'Text', props: { text: { $item: 'name' } }, children: [] } },
      { op: 'add', path: '/state/days', value: [] },
      { op: 'add', path: '/state/days/0', value: { name: 'Mon' } },
      { op: 'add', path: '/state/days/1', value: { name: 'Tue' } },
    ];
    const block = ['```spec', ...lines.map(line => JSON.stringify(line)), '```'].join('\n');
    const { model, prompts } = modelWriting(`Here.\n${block}`);

    const { messages } = await chat(model, 'My week?');

    expect(prompts).toHaveLength(1);
    const reply = messages.find(message => message.role === 'assistant')!;
    expect(buildSpecFromParts(reply.content.parts as any)?.state).toEqual({ days: [{ name: 'Mon' }, { name: 'Tue' }] });
  });

  it('edits the interface already in the thread with the patches the model writes', async () => {
    const rename = { op: 'replace', path: '/elements/card/props/title', value: 'Lyon' };
    const { model } = modelWriting(
      `Here.\n${specBlock(weatherCard)}`,
      `Renamed.\n\`\`\`spec\n${JSON.stringify(rename)}\n\`\`\``,
    );

    const { messages } = await chat(model, 'Weather in Paris?', 'Call it Lyon');

    const replies = messages.filter(message => message.role === 'assistant');
    expect(replies.map(reply => buildSpecFromParts(reply.content.parts as any))).toEqual([
      weatherCard,
      {
        ...weatherCard,
        elements: { ...weatherCard.elements, card: { ...weatherCard.elements.card, props: { title: 'Lyon' } } },
      },
    ]);
  });

  it('shows the model the interface it wrote, in the reply it wrote it in, and the request as the user sent it', async () => {
    const { model, prompts } = modelWriting(`Here.\n${specBlock(weatherCard)}`, 'Hello!', 'Renamed.');

    const { messages } = await chat(model, 'Weather in Paris?', 'Hi', 'Call it Lyon');

    expect(modelSaw(prompts[2])).toEqual([
      { role: 'user', text: 'Weather in Paris?' },
      { role: 'assistant', text: `Here.\n${specBlock(weatherCard)}` },
      { role: 'user', text: 'Hi' },
      { role: 'assistant', text: 'Hello!' },
      { role: 'user', text: 'Call it Lyon' },
    ]);
    expect(textOf(messages.filter(message => message.role === 'assistant')[0]!.content.parts)).toBe('Here.\n');
  });

  it('shows the model an interface it wrote with no prose around it', async () => {
    const { model, prompts } = modelWriting(specBlock(weatherCard), 'Hello!', 'Renamed.');

    await chat(model, 'Weather in Paris?', 'Hi', 'Call it Lyon');

    expect(modelSaw(prompts[2])).toEqual([
      { role: 'user', text: 'Weather in Paris?' },
      { role: 'assistant', text: specBlock(weatherCard) },
      { role: 'user', text: 'Hi' },
      { role: 'assistant', text: 'Hello!' },
      { role: 'user', text: 'Call it Lyon' },
    ]);
  });

  it('shows the model an interface a tool wrote, in the reply that followed it', async () => {
    const showWeather = createTool({
      id: 'showWeather',
      description: 'Shows the weather',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        await context.writer?.custom({ type: 'data-spec', data: { type: 'flat', spec: weatherCard } });
        return { shown: true };
      },
    });
    const { model, prompts } = modelWriting({ call: 'showWeather' }, 'Enjoy.', 'Bye!');

    await chat({ model, tools: { showWeather } }, 'Weather in Paris?', 'Thanks');

    expect(modelSaw(prompts[2])).toEqual([
      { role: 'user', text: 'Weather in Paris?' },
      { role: 'assistant', text: '' },
      { role: 'tool', text: '' },
      { role: 'assistant', text: `Enjoy.\n${specBlock(weatherCard)}` },
      { role: 'user', text: 'Thanks' },
    ]);
  });

  it('shows the model only the latest interface, as it is now', async () => {
    const rename = { op: 'replace', path: '/elements/card/props/title', value: 'Lyon' };
    const lyon = {
      ...weatherCard,
      elements: { ...weatherCard.elements, card: { ...weatherCard.elements.card, props: { title: 'Lyon' } } },
    };
    const { model, prompts } = modelWriting(
      `Here.\n${specBlock(weatherCard)}`,
      `Renamed.\n\`\`\`spec\n${JSON.stringify(rename)}\n\`\`\``,
      'Done.',
    );

    await chat(model, 'Weather in Paris?', 'Call it Lyon', 'Thanks');

    expect(modelSaw(prompts[2])).toEqual([
      { role: 'user', text: 'Weather in Paris?' },
      { role: 'assistant', text: 'Here.\n' },
      { role: 'user', text: 'Call it Lyon' },
      { role: 'assistant', text: `Renamed.\n${specBlock(lyon)}` },
      { role: 'user', text: 'Thanks' },
    ]);
  });

  it('edits the interface when the model writes only the patch lines', async () => {
    const rename = { op: 'replace', path: '/elements/card/props/title', value: 'Lyon' };
    const { model } = modelWriting(`Here.\n${specBlock(weatherCard)}`, JSON.stringify(rename));

    const { messages } = await chat(model, 'Weather in Paris?', 'Call it Lyon');

    const reply = messages.filter(message => message.role === 'assistant').at(-1)!;
    expect(buildSpecFromParts(reply.content.parts as any)).toEqual({
      ...weatherCard,
      elements: { ...weatherCard.elements, card: { ...weatherCard.elements.card, props: { title: 'Lyon' } } },
    });
  });

  it('shows the model the state the user set in the interface, in the interface it wrote', async () => {
    const { model, prompts } = modelWriting(`Here.\n${specBlock(weatherCard)}`, 'You picked Celsius.');

    await chat(model, 'Weather in Paris?', { text: 'Which unit did I pick?', state: { unit: 'celsius' } });

    expect(modelSaw(prompts[1])).toEqual([
      { role: 'user', text: 'Weather in Paris?' },
      { role: 'assistant', text: `Here.\n${specBlock({ ...weatherCard, state: { unit: 'celsius' } })}` },
      { role: 'user', text: 'Which unit did I pick?' },
    ]);
  });

  it('keeps what the user set in the interface when the model edits it', async () => {
    const rename = { op: 'replace', path: '/elements/card/props/title', value: 'Lyon' };
    const { model } = modelWriting(
      `Here.\n${specBlock({ ...weatherCard, state: { unit: 'fahrenheit' } })}`,
      `Renamed.\n\`\`\`spec\n${JSON.stringify(rename)}\n\`\`\``,
    );

    const { messages } = await chat(model, 'Weather in Paris?', { text: 'Call it Lyon', state: { unit: 'celsius' } });

    const edited = messages.filter(message => message.role === 'assistant').at(-1)!;
    expect(buildSpecFromParts(edited.content.parts as any)).toEqual({
      ...weatherCard,
      state: { unit: 'celsius' },
      elements: { ...weatherCard.elements, card: { ...weatherCard.elements.card, props: { title: 'Lyon' } } },
    });
  });

  it('starts a new interface, without the earlier one, when the block sets /root', async () => {
    const note = {
      root: 'note',
      elements: { note: { type: 'Text', props: { text: 'Bring an umbrella' }, children: [] } },
    };
    const { model } = modelWriting(`Here.\n${specBlock(weatherCard)}`, `Noted.\n${specBlock(note)}`);

    const { messages } = await chat(model, 'Weather in Paris?', 'Remind me of the umbrella');

    const replies = messages.filter(message => message.role === 'assistant');
    expect(replies.map(reply => buildSpecFromParts(reply.content.parts as any))).toEqual([weatherCard, note]);
  });

  it('keeps a last line that only looked like it could start a spec', async () => {
    const { model } = modelWriting('Install it first.\n`pnpm add zod` does it');

    const { streamed, messages } = await chat(model, 'How do I install zod?');

    const text = streamed.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.payload.text);
    expect(text.join('')).toBe('Install it first.\n`pnpm add zod` does it');
    const reply = messages.find(message => message.role === 'assistant')!;
    expect(textOf(reply.content.parts)).toBe('Install it first.\n`pnpm add zod` does it');
  });
});

function textOf(parts: unknown) {
  return (parts as { type: string; text?: string }[])
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('');
}
