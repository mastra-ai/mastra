// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThreadRow } from './thread-row';
import { LinkComponentProvider } from '@/lib/framework';
import { stubLinkPaths, TestLinkProvider } from '@/test/link-provider';

afterEach(cleanup);

describe('ThreadRow', () => {
  it('marks a private thread with a lock', () => {
    render(
      <TestLinkProvider>
        <ul>
          <ThreadRow href="#a" title="Deal desk" updated="4m" agents={[{ id: 'kit', name: 'Kit' }]} private />
        </ul>
      </TestLinkProvider>,
    );

    expect(screen.getByRole('img', { name: 'Private' })).toBeTruthy();
  });

  it('shows no lock on a shared thread', () => {
    render(
      <TestLinkProvider>
        <ul>
          <ThreadRow href="#a" title="Deal desk" updated="4m" agents={[{ id: 'kit', name: 'Kit' }]} />
        </ul>
      </TestLinkProvider>,
    );

    expect(screen.queryByRole('img', { name: 'Private' })).toBeNull();
  });

  it('opens a thread through the app router instead of reloading the page', () => {
    const navigate = vi.fn();
    const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(function RouterLink(
      { href, onClick, ...props },
      ref,
    ) {
      return (
        <a
          ref={ref}
          href={href}
          onClick={event => {
            onClick?.(event);
            event.preventDefault();
            navigate(href);
          }}
          {...props}
        />
      );
    });
    render(
      <LinkComponentProvider Link={RouterLink} navigate={navigate} paths={stubLinkPaths}>
        <ul>
          <ThreadRow href="/threads/desk" title="Deal desk" updated="4m" agents={[{ id: 'kit', name: 'Kit' }]} />
        </ul>
      </LinkComponentProvider>,
    );

    fireEvent.click(screen.getByRole('link', { name: /Deal desk/ }));

    expect(navigate).toHaveBeenCalledWith('/threads/desk');
  });
});
