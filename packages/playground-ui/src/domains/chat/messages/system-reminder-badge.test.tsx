// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SystemReminderBadge } from './system-reminder-badge';
import { parseSystemReminder } from './system-reminder-utils';

describe('parseSystemReminder', () => {
  it('parses reminder path, type, and decoded body', () => {
    const reminder = parseSystemReminder(
      '<system-reminder type="dynamic-agents-md" path="/repo/packages/core/AGENTS.md">Use &lt;tags&gt; &amp; keep quotes &quot;safe&quot;</system-reminder>',
    );

    expect(reminder).toEqual({
      type: 'dynamic-agents-md',
      path: '/repo/packages/core/AGENTS.md',
      body: 'Use <tags> & keep quotes "safe"',
    });
  });

  it('parses reminders without attributes', () => {
    expect(parseSystemReminder('<system-reminder>plain reminder body</system-reminder>')).toEqual({
      type: undefined,
      path: undefined,
      body: 'plain reminder body',
    });
  });

  it('returns null for non-reminder text', () => {
    expect(parseSystemReminder('plain user text')).toBeNull();
  });
});

describe('SystemReminderBadge', () => {
  it('falls back to plain text when the content is not a system reminder', () => {
    render(<SystemReminderBadge text="plain user text" />);

    expect(screen.getByText('plain user text')).toBeTruthy();
  });

  it('shows reminder details when expanded', () => {
    render(
      <SystemReminderBadge text='<system-reminder type="dynamic-agents-md" path="/repo/packages/core/AGENTS.md">Remember nested instructions</system-reminder>' />,
    );

    expect(screen.getByText('System reminder')).toBeTruthy();
    expect(screen.getByText('/repo/packages/core/AGENTS.md')).toBeTruthy();
    expect(screen.queryByText('Remember nested instructions')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /system reminder/i }));

    expect(screen.getByText('Remember nested instructions')).toBeTruthy();
  });
});
