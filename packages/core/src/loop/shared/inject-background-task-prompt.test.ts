import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';
import { injectBackgroundTaskPrompt } from './inject-background-task-prompt';

function makePrompt(): LanguageModelV2Prompt {
  return [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: [{ type: 'text', text: 'hello' }] },
  ];
}

const fakeManager = {} as any;

describe('injectBackgroundTaskPrompt', () => {
  it('returns inputMessages unchanged when no background-task manager is present', () => {
    const inputMessages = makePrompt();
    const result = injectBackgroundTaskPrompt({
      inputMessages,
      backgroundTaskManager: undefined,
      tools: { foo: { background: { enabled: true } } },
    });
    expect(result).toBe(inputMessages);
    expect(result[0]).toMatchObject({ role: 'system', content: 'You are a helpful assistant.' });
  });

  it('returns inputMessages unchanged when no tools are provided', () => {
    const inputMessages = makePrompt();
    const result = injectBackgroundTaskPrompt({
      inputMessages,
      backgroundTaskManager: fakeManager,
      tools: undefined,
    });
    expect(result).toBe(inputMessages);
  });

  it('returns inputMessages unchanged when the tools map is empty', () => {
    const inputMessages = makePrompt();
    const result = injectBackgroundTaskPrompt({
      inputMessages,
      backgroundTaskManager: fakeManager,
      tools: {},
    });
    expect(result).toBe(inputMessages);
    expect(result[0]).toMatchObject({ role: 'system', content: 'You are a helpful assistant.' });
  });

  it('appends background-task guidance to the leading system message when eligible', () => {
    const inputMessages = makePrompt();
    const result = injectBackgroundTaskPrompt({
      inputMessages,
      backgroundTaskManager: fakeManager,
      tools: { foo: { background: { enabled: true } } },
    });
    expect(result[0].role).toBe('system');
    const systemContent = (result[0] as { content: string }).content;
    expect(systemContent.startsWith('You are a helpful assistant.\n\n')).toBe(true);
    expect(systemContent).toContain('foo');
    expect(systemContent).toContain('_background');
  });

  it('honors agentBackgroundConfig.tools = "all" to enable injection for all tools', () => {
    const inputMessages = makePrompt();
    const result = injectBackgroundTaskPrompt({
      inputMessages,
      backgroundTaskManager: fakeManager,
      tools: { foo: {}, bar: {} },
      agentBackgroundConfig: { tools: 'all' },
    });
    const systemContent = (result[0] as { content: string }).content;
    expect(systemContent).toContain('foo');
    expect(systemContent).toContain('bar');
  });

  it('only injects into the leading system message, never user/assistant', () => {
    const inputMessages: LanguageModelV2Prompt = [
      { role: 'system', content: 'System A' },
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      { role: 'system', content: 'System B' },
    ];
    const result = injectBackgroundTaskPrompt({
      inputMessages,
      backgroundTaskManager: fakeManager,
      tools: { foo: { background: { enabled: true } } },
    });
    expect((result[0] as { content: string }).content.startsWith('System A\n\n')).toBe(true);
    // Second system message stays untouched
    expect((result[2] as { content: string }).content).toBe('System B');
  });
});
