// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { LogLevel } from '../types';
import { LogsLevelToggles } from './logs-level-toggles';
import { toggleLogLevel } from './toggle-log-level';
import { TooltipProvider } from '@/ds/components/Tooltip';

afterEach(cleanup);

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

describe('toggleLogLevel', () => {
  it('hides a level when every level is shown', () => {
    expect(toggleLogLevel(LEVELS, LEVELS, 'debug', false)).toEqual(['info', 'warn', 'error']);
  });

  it('shows a hidden level again in level order', () => {
    expect(toggleLogLevel(LEVELS, ['error'], 'info', false)).toEqual(['info', 'error']);
  });

  it('restores every level when the last shown level is hidden', () => {
    expect(toggleLogLevel(LEVELS, ['warn'], 'warn', false)).toEqual(LEVELS);
  });

  it('shows only the level on a modifier click', () => {
    expect(toggleLogLevel(LEVELS, LEVELS, 'error', true)).toEqual(['error']);
    expect(toggleLogLevel(LEVELS, ['info', 'warn'], 'warn', true)).toEqual(['warn']);
  });

  it('restores every level on a second modifier click of the only shown level', () => {
    expect(toggleLogLevel(LEVELS, ['error'], 'error', true)).toEqual(LEVELS);
  });
});

function Harness() {
  const [value, setValue] = useState<LogLevel[]>(LEVELS);
  return (
    <TooltipProvider delay={0}>
      <LogsLevelToggles levels={LEVELS} value={value} onValueChange={setValue} />
    </TooltipProvider>
  );
}

const pressed = () =>
  screen
    .getAllByRole('button')
    .filter(button => button.getAttribute('aria-pressed') === 'true')
    .map(button => button.textContent);

const hover = (element: HTMLElement) => {
  fireEvent.pointerEnter(element);
  fireEvent.mouseEnter(element);
  fireEvent.pointerMove(element);
  fireEvent.mouseMove(element);
  element.focus();
};

describe('LogsLevelToggles', () => {
  it('starts with every level shown and hides one on click', () => {
    render(<Harness />);
    expect(pressed()).toEqual(['Debug', 'Info', 'Warn', 'Error']);

    fireEvent.click(screen.getByRole('button', { name: 'Debug' }));

    expect(pressed()).toEqual(['Info', 'Warn', 'Error']);
  });

  it('shows only the clicked level with Cmd or Ctrl, and restores all on a second click', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Error' }), { metaKey: true });
    expect(pressed()).toEqual(['Error']);

    fireEvent.click(screen.getByRole('button', { name: 'Error' }), { ctrlKey: true });
    expect(pressed()).toEqual(['Debug', 'Info', 'Warn', 'Error']);
  });

  it('tells each toggle how to show only its level, and how to bring the others back', async () => {
    render(<Harness />);

    const error = screen.getByRole('button', { name: 'Error' });
    hover(error);
    expect((await screen.findByRole('tooltip')).textContent).toContain('Show only Error');

    fireEvent.click(error, { metaKey: true });
    hover(error);
    expect((await screen.findByRole('tooltip')).textContent).toContain('Show all levels');
  });
});
