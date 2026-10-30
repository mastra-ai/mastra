// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActivityStretchLine } from '../activity-stretch-line';
import type { ActivityMember } from '../model/activity-members';
import { ActivityDetail, ActivityWorkingDirectory } from '@/ds/components/ai/activity';
import { ArrivalScope } from '@/ds/components/Arrival';
import { ARRIVING_CLASS } from '@/ds/tokens';

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

  it('names a path under the working directory the way its line shows it', () => {
    render(
      <ActivityWorkingDirectory path="/sandboxes/7b45/mastra">
        <ActivityStretchLine members={[call('a', '/sandboxes/7b45/mastra/src/index.ts')]} live={false} />
      </ActivityWorkingDirectory>,
    );

    expect(screen.getByRole('group', { name: 'Read src/index.ts' })).toBeTruthy();
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

function recordMotion() {
  const animate = vi.fn(() => ({ playState: 'running', cancel: () => {}, finished: Promise.resolve() }));
  Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true });
  Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false }), configurable: true });
  const played = (motion: string) => animate.mock.calls.filter(call => JSON.stringify(call).includes(motion));
  return { rolls: () => played('translateY'), writes: () => played('maskPosition') };
}

describe('ActivityStretchLine motion', () => {
  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'animate');
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('keeps a settled line still when it mounts, even when React mounts it twice', () => {
    const motion = recordMotion();

    render(
      <StrictMode>
        <ActivityStretchLine members={[call('a', 'a.ts'), call('b', 'b.ts')]} live={false} />
      </StrictMode>,
    );

    expect(motion.rolls()).toEqual([]);
    expect(motion.writes()).toEqual([]);
  });

  it('writes a live line in once and rolls only when its words change', () => {
    const motion = recordMotion();
    const reading = (status: 'running' | 'done'): ActivityMember => ({ ...call('a', 'a.ts'), status });

    const { rerender } = render(
      <StrictMode>
        <ActivityStretchLine members={[reading('running')]} live />
      </StrictMode>,
    );

    expect(motion.writes()).toHaveLength(1);
    expect(motion.rolls()).toEqual([]);

    rerender(
      <StrictMode>
        <ActivityStretchLine members={[reading('done')]} live={false} elapsedMs={4000} />
      </StrictMode>,
    );

    expect(motion.rolls()).not.toEqual([]);
  });

  it('opens a settled line onto rows that are already there, with nothing fading in', () => {
    const detailed = (key: string, path: string): ActivityMember => ({
      ...call(key, path),
      row: <ActivityDetail>{path}</ActivityDetail>,
    });
    render(
      <ArrivalScope>
        <ActivityStretchLine members={[detailed('a', 'a.ts'), detailed('b', 'b.ts')]} live={false} />
      </ArrivalScope>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Read files/ }));

    expect(screen.getByText('a.ts').classList.contains(ARRIVING_CLASS)).toBe(false);
  });
});
