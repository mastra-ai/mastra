// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToolCallGroup } from './tool-call-group';
import type { ToolCallGroupStep } from './tool-call-group';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

afterEach(cleanup);

const view = (path: string): ToolCallGroupStep => ({ toolName: 'view', args: { path }, status: 'idle' });

describe('ToolCallGroup', () => {
  it('folds the steps into one row that names the live one and counts progress', () => {
    const steps = [
      view('a.ts'),
      { toolName: 'execute_command', args: { command: 'pnpm test' }, status: 'running' as const },
      view('b.ts'),
      view('c.ts'),
    ];
    render(
      <ToolCallGroup steps={steps}>
        <span>step cards</span>
      </ToolCallGroup>,
    );

    const group = screen.getByRole('group', { name: 'Tool group: 4 steps' });
    expect(group.getAttribute('aria-busy')).toBe('true');
    expect(within(group).getByText('4 steps')).toBeTruthy();
    expect(within(group).getByText('pnpm test')).toBeTruthy();
    expect(within(group).getByRole('img', { name: 'Read, Run' })).toBeTruthy();
    expect(within(group).getByText('3/4')).toBeTruthy();
    expect(screen.queryByText('step cards')).toBeNull();

    fireEvent.click(within(group).getByRole('button'));
    expect(screen.getByText('step cards')).toBeTruthy();
  });

  it('marks a settled group as failed when any step failed', () => {
    render(
      <ToolCallGroup steps={[view('a.ts'), { ...view('b.ts'), status: 'error' }, view('c.ts')]}>
        <span />
      </ToolCallGroup>,
    );

    const group = screen.getByRole('group', { name: 'Tool group: 3 steps' });
    expect(group.getAttribute('aria-busy')).toBe('false');
    expect(within(group).getByRole('img', { name: 'Failed' })).toBeTruthy();
  });
});
