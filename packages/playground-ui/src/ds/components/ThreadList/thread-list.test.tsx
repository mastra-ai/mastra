// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import {
  ThreadList,
  ThreadListEmpty,
  ThreadListItem,
  ThreadListItems,
  ThreadListNewItem,
  ThreadListSeparator,
} from './thread-list';

afterEach(cleanup);

function getParent(element: HTMLElement): HTMLElement {
  const parent = element.parentElement;
  assert(parent, 'Expected parent element');
  return parent;
}

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
    expect(getParent(nav).className).toContain('pl-2');
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
    expect(getParent(nav).className).not.toContain('pl-2');
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
    assert(contentBoundary, 'Expected content boundary');
    expect(contentBoundary.className).toContain('min-w-0');
    expect(contentBoundary.className).toContain('flex-1');
  });

  it('marks the active thread and leaves the others plain', () => {
    render(
      <>
        <ThreadListItem as="a" href="/threads/one" isActive>
          Active thread
        </ThreadListItem>
        <ThreadListItem as="a" href="/threads/two">
          Other thread
        </ThreadListItem>
      </>,
    );

    expect(screen.getByRole('link', { name: 'Active thread' }).className).toContain('bg-surface4');
    expect(screen.getByRole('link', { name: 'Other thread' }).className).not.toContain('bg-surface4');
  });

  it('offers no delete affordance, and no room for one, without a handler', () => {
    render(
      <ThreadListItem as="a" href="/threads/one">
        A thread
      </ThreadListItem>,
    );

    expect(screen.queryByRole('button')).toBeNull();
    // The row reclaims the space the delete button would have taken.
    expect(screen.getByRole('link', { name: 'A thread' }).className).not.toContain('pr-9');
  });

  it('deletes without following the thread link', () => {
    const onDelete = vi.fn();
    const onClick = vi.fn();
    render(
      <ThreadListItem as="a" href="/threads/one" onClick={onClick} onDelete={onDelete}>
        A thread
      </ThreadListItem>,
    );

    screen.getByRole('button', { name: 'delete' }).click();

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('lets the caller name the delete action', () => {
    render(
      <ThreadListItem as="a" href="/threads/one" onDelete={vi.fn()} deleteLabel="delete thread">
        A thread
      </ThreadListItem>,
    );

    expect(screen.getByRole('button', { name: 'delete thread' })).toBeTruthy();
  });

  it('keeps a caller class alongside its own', () => {
    render(
      <ThreadListItem as="a" href="/threads/one" className="my-own-class">
        A thread
      </ThreadListItem>,
    );

    const link = screen.getByRole('link', { name: 'A thread' });
    expect(link.className).toContain('my-own-class');
    expect(link.className).toContain('rounded-xl');
  });
});

describe('ThreadList building blocks', () => {
  it('lists its items as a list', () => {
    render(
      <ThreadListItems>
        <ThreadListItem as="a" href="/threads/one">
          A thread
        </ThreadListItem>
      </ThreadListItems>,
    );

    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('renders a new-thread entry point', () => {
    render(
      <ThreadListNewItem as="a" href="/threads/new">
        New thread
      </ThreadListNewItem>,
    );

    expect(screen.getByRole('link', { name: 'New thread' }).getAttribute('href')).toBe('/threads/new');
  });

  it('renders a separator that says nothing to a screen reader', () => {
    const { container } = render(<ThreadListSeparator />);

    expect(container.textContent).toBe('');
    expect(container.firstElementChild).not.toBeNull();
  });

  it('states why the list is empty', () => {
    render(<ThreadListEmpty>No threads yet</ThreadListEmpty>);

    expect(screen.getByText('No threads yet')).toBeTruthy();
  });
});
