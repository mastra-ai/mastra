// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThreadList, ThreadListItem } from './thread-list';

afterEach(cleanup);

describe('ThreadList', () => {
  it('renders standalone block chrome by default', () => {
    render(
      <ThreadList>
        <div>child</div>
      </ThreadList>,
    );

    const nav = screen.getByRole('navigation', { name: 'Threads' });
    expect(nav.className).toContain('bg-surface3');
    expect(nav.className).toContain('rounded-studio-panel');
    expect(nav.className).toContain('border-border1/50');
    expect(nav.parentElement!.className).toContain('pl-2');
  });

  it('drops block chrome and inset when embedded', () => {
    render(
      <ThreadList embedded>
        <div>child</div>
      </ThreadList>,
    );

    const nav = screen.getByRole('navigation', { name: 'Threads' });
    expect(nav.className).not.toContain('bg-surface3');
    expect(nav.className).not.toContain('rounded-studio-panel');
    expect(nav.className).not.toContain('border-border1/50');
    expect(nav.parentElement!.className).not.toContain('pl-2');
    expect(nav.className).toContain('overflow-y-auto');
  });
});

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
