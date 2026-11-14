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
    expect(prompt).toContain('SOURCE ATTRIBUTION');
    expect(prompt).toContain(
      'An observation that says what the user asked, stated, or wanted must contain only information from the user',
    );
    expect(prompt).toContain('Record what the agent or a tool found in its own observation');
    expect(prompt).toContain('Never drop a finding to keep it off the user');
  });

  it.each(Object.entries(prompts()))('%s includes the separated research example', (_name, prompt) => {
    expect(prompt).toContain(
      'BAD: 🔴 (10:00) User asked which university received the thesis (University of Glasgow, 1997, supervised by John P. Grant).',
    );
    expect(prompt).toContain(
      'GOOD: 🔴 (10:00) User asked which university received a thesis; the only clue they gave is that it is the fourth oldest university.',
    );
    expect(prompt).toContain(
      'GOOD: 🔴 (10:01) Agent found via web_search: thesis was submitted to the University of Glasgow in 1997, supervised by John P. Grant.',
    );
  });

  it('keeps the precise-terminology allowance from adding facts to the user line', () => {
    expect(OBSERVER_EXTRACTION_INSTRUCTIONS).toContain(
      "When the assistant interprets or confirms the user's vague language, prefer the assistant's precise terminology, but only to name what the user said more exactly. Never use it to add facts the user did not give.",
    );
  });

  it('Reflector keeps attribution when consolidating', () => {
    expect(buildReflectorSystemPrompt()).toContain(
      'When merging observations, never move a fact from an agent or tool observation into a "User asked" or "User stated" line.',
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
      expect(prompt).toContain('SOURCE ATTRIBUTION');
      expect(prompt).toContain(`=== CUSTOM INSTRUCTIONS ===\n\n${custom}`);
      expect(prompt.indexOf('SOURCE ATTRIBUTION')).toBeLessThan(prompt.indexOf(custom));
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
