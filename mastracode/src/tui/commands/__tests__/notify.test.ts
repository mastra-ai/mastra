import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleNotifyCommand } from '../notify.js';
import type { SlashCommandContext } from '../types.js';

const askModalQuestionMock = vi.fn();

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: vi.fn(async (_ui, props) => askModalQuestionMock(props)),
}));

function createContext(result?: any) {
  return {
    state: { ui: {} },
    harness: {
      sendNotificationSignal: vi.fn(
        async () =>
          result ?? {
            accepted: true,
            record: { id: 'notification-1' },
            decision: { action: 'deliver' },
          },
      ),
    },
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;
}

function queueAnswers(answers: Array<string | null>) {
  askModalQuestionMock.mockImplementation(async () => answers.shift() ?? null);
}

describe('handleNotifyCommand', () => {
  beforeEach(() => {
    askModalQuestionMock.mockReset();
  });

  it('prompts notification fields and sends the configured notification', async () => {
    const ctx = createContext();
    queueAnswers([
      'high',
      'github',
      'ci-status',
      'Yes',
      'workflow-run-1',
      'ci-main',
      'ci-status',
      '{"branch":"main","failed":true}',
      '{"url":"https://example.com/run/1"}',
      'CI failed on main',
    ]);

    await handleNotifyCommand(ctx, []);

    expect((ctx.harness as any).sendNotificationSignal).toHaveBeenCalledWith({
      source: 'github',
      kind: 'ci-status',
      priority: 'high',
      summary: 'CI failed on main',
      sourceId: 'workflow-run-1',
      dedupeKey: 'ci-main',
      coalesceKey: 'ci-status',
      attributes: { branch: 'main', failed: true },
      metadata: { url: 'https://example.com/run/1' },
    });
    expect(ctx.showInfo).toHaveBeenCalledWith('Notification notification-1 delivered.');
  });

  it('uses inline contents as the content modal default', async () => {
    const ctx = createContext();
    queueAnswers(['medium', 'mastracode', 'manual', 'No', 'Inline notification contents']);

    await handleNotifyCommand(ctx, ['Inline', 'notification', 'contents']);

    const contentPrompt = askModalQuestionMock.mock.calls.at(-1)?.[0];
    expect(contentPrompt).toMatchObject({
      question: 'Notification contents',
      defaultValue: 'Inline notification contents',
      multiline: true,
    });
    expect((ctx.harness as any).sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Inline notification contents' }),
    );
  });

  it('cancels without sending when a modal is canceled', async () => {
    const ctx = createContext();
    queueAnswers([null]);

    await handleNotifyCommand(ctx, []);

    expect((ctx.harness as any).sendNotificationSignal).not.toHaveBeenCalled();
    expect(ctx.showError).not.toHaveBeenCalled();
  });

  it('shows an error and does not send when advanced JSON is invalid', async () => {
    const ctx = createContext();
    queueAnswers(['medium', 'mastracode', 'manual', 'Yes', '', '', '', 'not-json', '{}', 'Contents']);

    await handleNotifyCommand(ctx, []);

    expect((ctx.harness as any).sendNotificationSignal).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('Invalid attributes JSON'));
  });

  it.each([
    [{ action: 'queue' }, 'Notification notification-1 queued.'],
    [
      { action: 'defer', deliverAt: new Date('2026-05-30T12:00:00Z') },
      'Notification notification-1 batched for later delivery until 2026-05-30T12:00:00.000Z.',
    ],
    [
      { action: 'summarize', summaryAt: new Date('2026-05-30T12:00:00Z') },
      'Notification notification-1 saved for summary until 2026-05-30T12:00:00.000Z.',
    ],
    [{ action: 'persist' }, 'Notification notification-1 saved to inbox.'],
    [{ action: 'discard' }, 'Notification notification-1 discarded.'],
  ])('shows a decision-aware confirmation for %s', async (decision, expectedMessage) => {
    const ctx = createContext({ accepted: true, record: { id: 'notification-1' }, decision });
    queueAnswers(['low', 'mastracode', 'manual', 'No', 'Contents']);

    await handleNotifyCommand(ctx, []);

    expect(ctx.showInfo).toHaveBeenCalledWith(expectedMessage);
  });
});
