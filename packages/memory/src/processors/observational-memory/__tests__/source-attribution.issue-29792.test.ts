import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import {
  buildObserverSystemPrompt,
  formatMessagesForObserver,
  OBSERVER_EXTRACTION_INSTRUCTIONS,
} from '../observer-agent';
import { buildReflectorSystemPrompt } from '../reflector-agent';

/**
 * Regression coverage for https://github.com/mastra-ai/mastra/issues/29792.
 *
 * The Observer wrote facts the agent found with tools onto the line recording what the user
 * asked. These tests pin the instruction contract every Observer and the Reflector receive.
 * They prove the guidance is delivered, not that a model follows it.
 */

const prompts = () => ({
  'single-thread Observer': buildObserverSystemPrompt(false),
  'multi-thread Observer': buildObserverSystemPrompt(true),
  Reflector: buildReflectorSystemPrompt(),
});

describe('source attribution guidance (#29792)', () => {
  it.each(Object.entries(prompts()))('%s keeps user lines to what the user said', (_name, prompt) => {
    expect(prompt).toContain(
      'A line about what the user asked or stated holds only what the user said. Put facts the agent or a tool found on their own line, attributed to the agent or tool, and keep them.',
    );
  });

  it('keeps the precise-terminology allowance from adding facts to the user line', () => {
    expect(OBSERVER_EXTRACTION_INSTRUCTIONS).toContain(
      "prefer the assistant's precise terminology, without adding facts the user didn't give.",
    );
  });

  it('Reflector keeps attribution when consolidating', () => {
    expect(buildReflectorSystemPrompt()).toContain(
      'When merging, don\'t move facts the agent or a tool found into a "User asked" or "User stated" line.',
    );
  });

  it.each(Object.entries(prompts()))('%s still treats explicit user facts as authoritative', (_name, prompt) => {
    expect(prompt).toContain('USER ASSERTIONS ARE AUTHORITATIVE');
    expect(prompt).toContain('🔴 (14:30) User stated has two kids');
  });

  it('custom instructions still compose after the shared guidance', () => {
    const custom = 'Prefix every observation about invoices with [billing].';
    for (const prompt of [
      buildObserverSystemPrompt(false, custom),
      buildObserverSystemPrompt(true, custom),
      buildReflectorSystemPrompt(custom),
    ]) {
      expect(prompt).toContain('holds only what the user said');
      expect(prompt).toContain(`=== CUSTOM INSTRUCTIONS ===\n\n${custom}`);
      expect(prompt.indexOf('holds only what the user said')).toBeLessThan(prompt.indexOf(custom));
    }
  });

  it('the formatter already labels the user question, tool result, and assistant reply separately', () => {
    const messages = [
      {
        id: 'u',
        role: 'user',
        createdAt: new Date('2026-01-01T10:00:00Z'),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Which university received the thesis? It was the fourth oldest university.' }],
        },
      },
      {
        id: 't',
        role: 'assistant',
        createdAt: new Date('2026-01-01T10:01:00Z'),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 's',
                toolName: 'web_search',
                args: { query: 'fourth oldest university thesis' },
                state: 'result',
                result: 'University of Glasgow; submitted 1997; supervisor John P. Grant.',
              },
            },
          ],
        },
      },
    ] as unknown as MastraDBMessage[];
    const rendered = formatMessagesForObserver(messages, { timeZone: 'UTC' });
    const userLines = rendered
      .split('\n')
      .filter(line => /^\*\*User\b|^User\b/.test(line))
      .join('\n');
    expect(rendered).toContain('Which university received the thesis');
    expect(userLines).not.toMatch(/Glasgow|1997|Grant/);
    expect(rendered).toContain('University of Glasgow; submitted 1997');
  });
});
