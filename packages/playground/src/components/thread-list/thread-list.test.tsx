// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThreadListItem } from './thread-list';

afterEach(cleanup);

describe('ThreadListItem', () => {
  it('contains row content in a shrinkable overflow boundary', () => {
    render(
      <ThreadListItem as="a" href="/threads/thread-1" onDelete={vi.fn()} deleteLabel="delete thread">
        ThisIsAReallyLongUnbrokenThreadTitle
      </ThreadListItem>,
    );

    const link = screen.getByRole('link', { name: 'ThisIsAReallyLongUnbrokenThreadTitle' });
    expect(link.className).toContain('min-w-0');
    expect(link.className).toContain('text-left');
    expect(link.className).toContain('pr-9');

    const contentBoundary = link.querySelector('span');
    expect(contentBoundary).not.toBeNull();
    expect(contentBoundary!.className).toContain('min-w-0');
    expect(contentBoundary!.className).toContain('flex-1');
  });
});
