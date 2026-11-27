import { buildSpecFromParts } from '@json-render/react';
import type { DataPart } from '@json-render/react';
import { describe, expect, it } from 'vitest';
import { chat, modelSaw, modelWriting, specBlock } from '../__tests__/test-utils';
import { studioCatalog } from './index';

const signupForm = {
  root: 'card',
  state: { form: { email: '' } },
  elements: {
    card: { type: 'Card', props: { title: 'Join the beta' }, children: ['revenue', 'email', 'submit'] },
    revenue: { type: 'Stat', props: { label: 'Seats left', value: '12', trend: 'down' }, children: [] },
    email: {
      type: 'Input',
      props: { label: 'Email', type: 'email', value: { $bindState: '/form/email' } },
      children: [],
    },
    submit: {
      type: 'Button',
      props: { label: 'Join', variant: 'primary' },
      on: { press: { action: 'sendMessage', params: { message: 'Sign me up' } } },
      children: [],
    },
  },
};

describe('studioCatalog', () => {
  it('lets an agent compose an interface from the Studio components', async () => {
    const { model } = modelWriting(`Fill this in.\n${specBlock(signupForm)}`);

    const { messages } = await chat({ model, catalog: studioCatalog }, 'Sign me up for the beta');

    const reply = messages.find(message => message.role === 'assistant')!;
    expect(buildSpecFromParts(reply.content.parts as DataPart[])).toEqual(signupForm);
  });

  it('sends back a spec whose props are not ones Studio can draw', async () => {
    const badBadge = {
      root: 'badge',
      elements: { badge: { type: 'Badge', props: { text: 'Blocked', variant: 'red' }, children: [] } },
    };
    const goodBadge = {
      root: 'badge',
      elements: { badge: { type: 'Badge', props: { text: 'Blocked', variant: 'destructive' }, children: [] } },
    };
    const { model, prompts } = modelWriting(specBlock(badBadge), specBlock(goodBadge));

    const { messages } = await chat({ model, catalog: studioCatalog }, 'Status?');

    expect(prompts).toHaveLength(2);
    expect(modelSaw(prompts[1]).at(-1)!.text).toContain('"badge" (Badge) prop "variant"');
    const reply = messages.find(message => message.role === 'assistant')!;
    expect(buildSpecFromParts(reply.content.parts as DataPart[])).toEqual(goodBadge);
  });

  it('describes every component and the sendMessage action in its prompt', () => {
    const prompt = studioCatalog.prompt({ mode: 'inline' });

    for (const name of studioCatalog.componentNames) expect(prompt).toContain(name);
    expect(prompt).toContain('sendMessage');
  });
});
