import { describe, expect, it } from 'vitest';
import { attributePromptRegions } from './region-attribution';
import { MessageList } from './index';

const sumRegions = (regions: Record<string, number>) => Object.values(regions).reduce((a, b) => a + b, 0);

describe('attributePromptRegions', () => {
  it('attributes untagged system messages to the system region', () => {
    const messageList = new MessageList();
    messageList.addSystem('You are a helpful assistant.');

    const inputMessages = [{ role: 'system', content: 'You are a helpful assistant.' }];
    const result = attributePromptRegions({ messageList, inputMessages });

    expect(Object.keys(result.regions)).toEqual(['system']);
    expect(result.regions.system).toBeGreaterThan(0);
    expect(result.method).toBe('tokenx-estimate');
    expect(sumRegions(result.regions)).toBe(result.totalEstimated);
  });

  it('attributes tagged system messages to per-tag regions', () => {
    const messageList = new MessageList();
    messageList.addSystem('Base instructions.');
    messageList.addSystem('Working memory block contents.', 'memory');
    messageList.addSystem('Observation block contents here.', 'observational-memory');

    const inputMessages = [
      { role: 'system', content: 'Base instructions.' },
      { role: 'system', content: 'Working memory block contents.' },
      { role: 'system', content: 'Observation block contents here.' },
    ];
    const result = attributePromptRegions({ messageList, inputMessages });

    expect(Object.keys(result.regions).sort()).toEqual([
      'system',
      'tagged-system:memory',
      'tagged-system:observational-memory',
    ]);
    expect(sumRegions(result.regions)).toBe(result.totalEstimated);
  });

  it('attributes non-system messages to the messages region', () => {
    const messageList = new MessageList();
    messageList.addSystem('Instructions.', 'memory');

    const inputMessages = [
      { role: 'system', content: 'Instructions.' },
      { role: 'user', content: [{ type: 'text', text: 'Hello there' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Hi! How can I help?' }] },
    ];
    const result = attributePromptRegions({ messageList, inputMessages });

    expect(Object.keys(result.regions).sort()).toEqual(['messages', 'tagged-system:memory']);
    expect(result.regions.messages).toBeGreaterThan(0);
    expect(sumRegions(result.regions)).toBe(result.totalEstimated);
  });

  it('returns an empty attribution for an empty prompt', () => {
    const messageList = new MessageList();
    const result = attributePromptRegions({ messageList, inputMessages: [] });

    expect(result.regions).toEqual({});
    expect(result.totalEstimated).toBe(0);
  });

  it('puts injected system content not present in the MessageList into unattributed', () => {
    const messageList = new MessageList();
    messageList.addSystem('Known system message.');

    const inputMessages = [
      { role: 'system', content: 'Known system message.' },
      // e.g. applyAutoResumeSystemMessage / injectBackgroundTaskPrompt / processor rewrite
      { role: 'system', content: 'Injected by a processor after render.' },
      { role: 'user', content: [{ type: 'text', text: 'question' }] },
    ];
    const result = attributePromptRegions({ messageList, inputMessages });

    expect(Object.keys(result.regions).sort()).toEqual(['messages', 'system', 'unattributed']);
    expect(result.regions.unattributed).toBeGreaterThan(0);
    expect(sumRegions(result.regions)).toBe(result.totalEstimated);
  });

  it('never mutates its inputs', () => {
    const messageList = new MessageList();
    messageList.addSystem('Stable.');
    const inputMessages = [{ role: 'system', content: 'Stable.' }];
    const before = JSON.stringify(inputMessages);
    const serializedBefore = JSON.stringify(messageList.serializeForSpan());

    attributePromptRegions({ messageList, inputMessages });

    expect(JSON.stringify(inputMessages)).toBe(before);
    expect(JSON.stringify(messageList.serializeForSpan())).toBe(serializedBefore);
  });
});
