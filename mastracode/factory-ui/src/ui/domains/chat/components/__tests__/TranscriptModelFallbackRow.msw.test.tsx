import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { TranscriptEntries } from '../Transcript';

const reply: MastraDBMessage = {
  id: 'reply-1',
  role: 'assistant',
  createdAt: new Date('2026-11-23T10:00:00.000Z'),
  content: {
    format: 2,
    parts: [
      {
        type: 'data-mastracode-model-fallback',
        data: {
          from: { entryId: 'anthropic/claude-opus-5.5', label: 'anthropic/claude-opus-5.5' },
          to: { entryId: 'openai/gpt-5.6-sol', label: 'openai/gpt-5.6-sol' },
          reason: 'pool-exhausted',
          at: '2026-11-23T10:00:00.000Z',
          failure: { kind: 'rate_limited' },
        },
      },
      { type: 'text', text: 'Reviewed on the fallback' },
    ],
  },
};

describe('a reply that switched to a fallback model', () => {
  it('names the failed model and its replacement, and says the next message starts on the session model', async () => {
    renderWithProviders(
      <TranscriptEntries
        entries={[{ kind: 'message', id: reply.id, message: reply }]}
        onApprove={() => {}}
        onRespond={() => {}}
      />,
    );

    const row = screen.getByRole('group', { name: 'Claude Opus 5.5 is rate-limited, switched to GPT-5.6 Sol' });
    expect(within(row).queryByText(/session model/)).not.toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button'));

    expect(within(row).getByText('Your next message starts on the session model again.')).toBeVisible();
    expect(screen.getByText('Reviewed on the fallback')).toBeVisible();
  });
});
