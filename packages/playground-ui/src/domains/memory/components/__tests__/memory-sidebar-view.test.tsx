// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloneThreadControl } from '../clone-thread-control';
import { MemorySidebarView } from '../memory-sidebar-view';
import { ObservationalMemoryDisplay } from '../observational-memory-display';

afterEach(cleanup);

const progress = {
  pendingMessageTokens: 1500,
  messageTokensThreshold: 3000,
  isObserving: false,
  totalBudget: 0,
  observationTokenCount: 400,
  observationTokensThreshold: 800,
  isReflecting: false,
};

describe('ObservationalMemoryDisplay', () => {
  it('renders loading, disabled, and enabled progress from host data', () => {
    const onAnalyze = vi.fn();
    const { rerender } = render(<ObservationalMemoryDisplay {...progress} isLoading isEnabled onAnalyze={onAnalyze} />);
    expect(screen.queryByRole('button', { name: 'Analyze observations' })).toBeNull();

    rerender(<ObservationalMemoryDisplay {...progress} isLoading={false} isEnabled={false} onAnalyze={onAnalyze} />);
    expect(screen.getByRole('link', { name: /Learn about Observational Memory/i }).getAttribute('href')).toContain(
      'observational-memory',
    );
    expect(screen.queryByRole('button', { name: 'Analyze observations' })).toBeNull();

    rerender(<ObservationalMemoryDisplay {...progress} isLoading={false} isEnabled onAnalyze={onAnalyze} />);
    expect(screen.getByText('1.5k')).toBeTruthy();
    expect(screen.getByText('400')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze observations' }));
    expect(onAnalyze).toHaveBeenCalledOnce();
  });
});

describe('CloneThreadControl', () => {
  it('delegates clone and prevents repeat actions while cloning or disabled', () => {
    const onClone = vi.fn();
    const { rerender } = render(<CloneThreadControl onClone={onClone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));
    expect(onClone).toHaveBeenCalledOnce();

    rerender(<CloneThreadControl isCloning onClone={onClone} />);
    expect(screen.getByRole('button', { name: 'Cloning...' }).hasAttribute('disabled')).toBe(true);
    rerender(<CloneThreadControl disabled onClone={onClone} />);
    expect(screen.getByRole('button', { name: 'Clone' }).hasAttribute('disabled')).toBe(true);
    expect(onClone).toHaveBeenCalledOnce();
  });
});

describe('MemorySidebarView', () => {
  it('renders host slots and delegates tab selection', () => {
    const onTabChange = vi.fn();
    render(
      <MemorySidebarView
        hasMemory
        showMemory={false}
        recentMessages={{ description: 'Last 10 messages', enabled: true, maxMessages: 10 }}
        semanticRecallOn
        workingMemoryOn={false}
        observationalOn
        observationPercent={50}
        threadsSlot={<div>Thread host content</div>}
        memorySlot={<div>Memory host content</div>}
        footerSlot={<div>Footer host content</div>}
        onTabChange={onTabChange}
      />,
    );
    expect(screen.getByText('Thread host content')).toBeTruthy();
    expect(screen.getByText('Footer host content')).toBeTruthy();
    fireEvent.click(screen.getByTestId('memory-sidebar-card'));
    expect(onTabChange).toHaveBeenCalledWith('memory');
  });
});
