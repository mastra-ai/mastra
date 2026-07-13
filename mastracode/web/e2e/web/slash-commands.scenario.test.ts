import { transcriptReducer, initialTranscript } from '@mastra/code-app/chat/transcript';
import { describe, it, expect } from 'vitest';

/**
 * Slash commands are client-side only (they push local notices into the
 * transcript reducer). No server round-trip needed, so we test them by
 * driving the reducer directly — faster and more deterministic than a
 * full scenario.
 */

describe('slash commands (reducer-level)', () => {
  it('/help produces a notice listing available commands', () => {
    // Simulate what App.tsx does when the user types /help:
    // it calls session.pushNotice('Available commands: ...')
    // which dispatches { type: 'localNotice', text, level: 'info' }.
    const helpText = [
      'Available commands:',
      '  /mode <id>        — Switch mode',
      '  /help              — Show this list',
    ].join('\n');

    const state = transcriptReducer(initialTranscript, {
      type: 'localNotice',
      text: helpText,
      level: 'info',
    });

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].kind).toBe('notice');
    if (state.entries[0].kind === 'notice') {
      expect(state.entries[0].text).toContain('Available commands:');
      expect(state.entries[0].level).toBe('info');
    }
  });

  it('/cost produces a notice with token usage', () => {
    // Simulate a usage_update event followed by a /cost notice.
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'usage_update', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } },
    });

    // App.tsx reads transcript.usage and formats a notice.
    const u = state.usage;
    const costText = `Tokens — prompt: ${u?.promptTokens ?? 0}, completion: ${u?.completionTokens ?? 0}, total: ${u?.totalTokens}`;
    state = transcriptReducer(state, { type: 'localNotice', text: costText, level: 'info' });

    const notice = state.entries.find(e => e.kind === 'notice');
    expect(notice).toBeDefined();
    if (notice?.kind === 'notice') {
      expect(notice.text).toContain('prompt: 100');
      expect(notice.text).toContain('total: 150');
    }
  });

  it('/settings dumps session state as a notice', () => {
    let state = transcriptReducer(initialTranscript, { type: 'reset', threadId: 'thread-123' });

    // Mode/model live in the session-state layer (ChatModes/ChatModels), not
    // the transcript — /settings combines both, exactly like useRunPaletteCommand.
    const activeModeId = 'build';
    const activeModelId = 'openai/gpt-4o';
    const lines = [`Mode: ${activeModeId}`, `Model: ${activeModelId}`, `Thread: ${state.threadId}`];
    state = transcriptReducer(state, { type: 'localNotice', text: lines.join('\n'), level: 'info' });

    const notice = state.entries.find(e => e.kind === 'notice');
    expect(notice).toBeDefined();
    if (notice?.kind === 'notice') {
      expect(notice.text).toContain('Mode: build');
      expect(notice.text).toContain('Model: openai/gpt-4o');
      expect(notice.text).toContain('Thread: thread-123');
    }
  });

  it('unknown command produces an error notice', () => {
    const state = transcriptReducer(initialTranscript, {
      type: 'localNotice',
      text: 'Unknown command: /foo. Type /help for available commands.',
      level: 'error',
    });

    expect(state.entries).toHaveLength(1);
    const entry = state.entries[0];
    expect(entry.kind).toBe('notice');
    if (entry.kind !== 'notice') throw new Error('expected a notice entry');
    expect(entry.level).toBe('error');
    expect(entry.text).toContain('/foo');
  });
});
