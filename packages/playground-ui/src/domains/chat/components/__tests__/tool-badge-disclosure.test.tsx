// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolBadgeDisclosure } from '../tool-badge-disclosure';

afterEach(cleanup);

describe('ToolBadgeDisclosure', () => {
  describe('when application callbacks are absent', () => {
    it('lets the reader reveal tool details without application providers', () => {
      render(
        <ToolBadgeDisclosure title="Search" isRunning={false}>
          <p>Found the migration guide</p>
        </ToolBadgeDisclosure>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      expect(screen.getByText('Found the migration guide')).toBeTruthy();
    });
  });
  describe('when a tool-open callback is provided', () => {
    it('reports the opened tool without reporting its closure', () => {
      const onToolOpen = vi.fn();
      render(
        <ToolBadgeDisclosure title="Search" toolCallId="call-search" isRunning={false} onToolOpen={onToolOpen}>
          Result
        </ToolBadgeDisclosure>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      expect(onToolOpen).toHaveBeenCalledExactlyOnceWith('call-search');
    });
  });
  describe('when a tool changes its initial collapse state', () => {
    it('reveals the newly available details', () => {
      const { rerender } = render(
        <ToolBadgeDisclosure title="Search" isRunning={false}>
          Result
        </ToolBadgeDisclosure>,
      );
      rerender(
        <ToolBadgeDisclosure title="Search" isRunning={false} initialCollapsed={false}>
          Result
        </ToolBadgeDisclosure>,
      );
      expect(screen.getByRole('button', { name: 'Search' }).getAttribute('aria-expanded')).toBe('true');
    });
  });
});
