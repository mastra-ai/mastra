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

const view = (path: string): ToolCallGroupStep => ({
  toolName: 'view',
  args: { path },
  status: 'idle',
  hasResult: true,
});

describe('ToolCallGroup', () => {
  describe('when a group is no longer running', () => {
    const success = view('a.ts');
    const failure: ToolCallGroupStep = { ...view('b.ts'), status: 'error' };
    const incomplete: ToolCallGroupStep = { ...view('c.ts'), hasResult: false };

    it.each([
      { steps: [success, success, success], summary: '3 OK' },
      { steps: [success, failure, failure], summary: '1 OK · 2 failed' },
      { steps: [failure, failure, failure], summary: '3 failed' },
      { steps: [success, incomplete, incomplete], summary: '1 OK · 2 incomplete' },
      { steps: [success, failure, incomplete], summary: '1 OK · 1 failed · 1 incomplete' },
      { steps: [incomplete, incomplete, incomplete], summary: '3 incomplete' },
    ])('shows $summary without expanding', ({ steps, summary }) => {
      render(
        <ToolCallGroup steps={steps}>
          <span>details</span>
        </ToolCallGroup>,
      );
      expect(screen.getByText(summary)).toBeTruthy();
      expect(screen.queryByRole('img', { name: 'Failed' }) !== null).toBe(summary.includes('failed'));
      expect(screen.queryByText('details')).toBeNull();
    });
  });

  describe('when callers do not supply outcome information', () => {
    const legacy: ToolCallGroupStep = { toolName: 'view', args: {}, status: 'idle' };

    it.each([
      [legacy, legacy, legacy],
      [view('a.ts'), legacy, { ...view('c.ts'), hasResult: false }],
    ])('preserves the previous summary instead of assuming incomplete calls', (...steps) => {
      render(
        <ToolCallGroup steps={steps}>
          <span />
        </ToolCallGroup>,
      );
      expect(screen.getByText('3 steps')).toBeTruthy();
      expect(screen.queryByText(/OK|failed|incomplete/)).toBeNull();
      expect(screen.queryByRole('img', { name: 'Failed' })).toBeNull();
    });

    it('preserves the failure indicator for legacy callers', () => {
      render(
        <ToolCallGroup steps={[legacy, { ...legacy, status: 'error' }, legacy]}>
          <span />
        </ToolCallGroup>,
      );
      expect(screen.getByRole('img', { name: 'Failed' })).toBeTruthy();
      expect(screen.queryByText(/OK|failed|incomplete/)).toBeNull();
    });

    it('preserves progress for legacy callers', () => {
      render(
        <ToolCallGroup steps={[legacy, { ...legacy, status: 'running' }, legacy]}>
          <span />
        </ToolCallGroup>,
      );
      expect(screen.getByText('2/3')).toBeTruthy();
    });
  });

  describe('when a running group settles', () => {
    it('replaces progress with recorded outcomes', () => {
      const pending: ToolCallGroupStep = { ...view('b.ts'), status: 'running', hasResult: false };
      const { rerender } = render(
        <ToolCallGroup steps={[view('a.ts'), pending, pending]}>
          <span />
        </ToolCallGroup>,
      );
      expect(screen.getByText('1/3')).toBeTruthy();
      rerender(
        <ToolCallGroup steps={[view('a.ts'), { ...pending, status: 'error' }, { ...pending, status: 'idle' }]}>
          <span />
        </ToolCallGroup>,
      );
      expect(screen.getByText('1 OK · 1 failed · 1 incomplete')).toBeTruthy();
      expect(screen.queryByText('1/3')).toBeNull();
    });
  });

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
