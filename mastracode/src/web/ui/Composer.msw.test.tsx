import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../e2e/web-ui/render';
import { Composer } from './Composer';

function baseProps(overrides: Record<string, unknown> = {}) {
  const session = {
    switchModel: vi.fn(),
    setGoal: vi.fn(),
    clearGoal: vi.fn(),
    pauseGoal: vi.fn(),
    resumeGoal: vi.fn(),
    getPermissions: vi.fn(async () => ({ categories: {}, tools: {} })),
    setPermissionForCategory: vi.fn(),
    pushNotice: vi.fn(),
    followUp: vi.fn(),
    abort: vi.fn(),
  };

  return {
    activeProject: null,
    transcript: {
      entries: [],
      pending: false,
      tasks: [],
      followUpCount: 0,
      notices: [],
      tokensPerSec: 0,
      _decodeStartedAt: 0,
      usage: undefined,
      omPhase: 'idle',
      modeId: 'build',
      modelId: 'openai/gpt-4o-mini',
      threadId: 'thread-1',
      running: false,
    },
    status: 'ready',
    busy: false,
    send: vi.fn(),
    steer: vi.fn(),
    abort: vi.fn(),
    commandNameToApply: null,
    onCommandApplied: vi.fn(),
    session,
    ...overrides,
  } as React.ComponentProps<typeof Composer> & { session: typeof session };
}

describe('Composer', () => {
  describe('when entering exact no-arg slash commands', () => {
    it('runs the command instead of completing the suggestion', async () => {
      const props = baseProps();
      renderWithProviders(<Composer {...props} />);

      await userEvent.type(screen.getByRole('textbox'), '/help{Enter}');

      expect(props.session.pushNotice).toHaveBeenCalledWith(expect.stringContaining('Available commands:'));
      expect(props.send).not.toHaveBeenCalled();
    });
  });

  describe('when entering a partial slash command', () => {
    it('completes the highlighted suggestion on Enter', async () => {
      const props = baseProps();
      renderWithProviders(<Composer {...props} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '/he{Enter}');

      expect(input).toHaveValue('/help ');
      expect(props.session.pushNotice).not.toHaveBeenCalled();
      expect(props.send).not.toHaveBeenCalled();
    });
  });

  describe('when a palette command is applied', () => {
    it('prefills the composer and acknowledges the handoff', () => {
      const props = baseProps({ commandNameToApply: 'model' });
      renderWithProviders(<Composer {...props} />);

      expect(screen.getByRole('textbox')).toHaveValue('/model ');
      expect(props.onCommandApplied).toHaveBeenCalled();
    });
  });
});
