// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ActivityStretchLine } from '../activity-stretch-line';
import type { ActivityMember } from '../model/activity-members';

const call = (key: string, path: string): ActivityMember => ({
  kind: 'call',
  key,
  toolName: 'view',
  args: { path },
  status: 'done',
  row: <p>Row for {path}</p>,
});
const thought: ActivityMember = { kind: 'thought', key: 'thought', content: { text: 'Both files agree.' } };

afterEach(cleanup);

describe('ActivityStretchLine without a disclosure provider', () => {
  it('keeps the calls the reader opened open when a thought joins them', () => {
    const calls = [call('a', 'a.ts'), call('b', 'b.ts')];
    const { rerender } = render(<ActivityStretchLine members={calls} live={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Read files/ }));
    expect(screen.getByText('Row for a.ts')).toBeTruthy();

    rerender(<ActivityStretchLine members={[...calls, thought]} live={false} />);

    expect(screen.getByText('Both files agree.')).toBeTruthy();
    expect(screen.getByText('Row for a.ts')).toBeTruthy();
  });
});

describe('ActivityStretchLine glyph', () => {
  it('wears the agent indicator while it thinks, and rests that same indicator once it only thought', () => {
    const { container, rerender } = render(<ActivityStretchLine members={[thought]} live />);
    const thinking = container.querySelector('.agent-indicator[data-state="thinking"]');
    expect(thinking).not.toBeNull();

    rerender(<ActivityStretchLine members={[thought]} live={false} />);

    expect(container.querySelector('.agent-indicator[data-state="idle"]')).toBe(thinking);
  });

  it('turns into a terminal while a command runs', () => {
    const command: ActivityMember = {
      kind: 'call',
      key: 'run',
      toolName: 'execute_command',
      args: { command: 'pnpm test' },
      status: 'running',
      row: <p>Ran</p>,
    };
    const { container } = render(<ActivityStretchLine members={[command]} live />);

    expect(container.querySelector('.agent-indicator[data-state="running"]')).not.toBeNull();
  });

  it('browses while a web search runs, then rests that same indicator once settled', () => {
    const search = (status: 'running' | 'done'): ActivityMember => ({
      kind: 'call',
      key: 'search',
      toolName: 'web_search',
      args: { query: 'oauth' },
      status,
      row: <p>Searched</p>,
    });
    const { container, rerender } = render(<ActivityStretchLine members={[search('running')]} live />);
    const browsing = container.querySelector('.agent-indicator[data-state="browsing"]');
    expect(browsing).not.toBeNull();

    rerender(<ActivityStretchLine members={[search('done')]} live={false} />);

    expect(container.querySelector('.agent-indicator[data-state="idle"]')).toBe(browsing);
  });
});
