// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { KnowledgeLinksProvider, KnowledgePageLink } from './knowledge-links';
import type { UseKnowledgePagePreview } from './knowledge-links';

afterEach(() => cleanup());

const Anchor = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(
  (props, ref) => <a ref={ref} {...props} />,
);

const preview: UseKnowledgePagePreview = target => ({
  name: 'Refunds',
  kind: 'Page',
  pageRef: target.pageRef ?? 'org:acme#policies/refunds',
  childCount: '3',
  links: { in: 4, out: 2 },
});

describe('KnowledgePageLink hover card', () => {
  it('has no card, and does not call the lookup, when the host gives no preview hook', () => {
    render(
      <KnowledgeLinksProvider pageHref={id => `/k?page=${id}`} Link={Anchor}>
        <KnowledgePageLink pageId="p1">Refunds</KnowledgePageLink>
      </KnowledgeLinksProvider>,
    );
    expect(screen.getByRole('link', { name: 'Refunds' }).getAttribute('href')).toBe('/k?page=p1');
    expect(screen.queryByTestId('knowledge-link-card')).toBeNull();
  });

  it('does not look the page up until the card opens', () => {
    const calls: string[] = [];
    render(
      <KnowledgeLinksProvider
        pageHref={id => `/k?page=${id}`}
        Link={Anchor}
        usePagePreview={target => {
          calls.push(target.pageId ?? target.pageRef);
          return preview(target);
        }}
      >
        <KnowledgePageLink pageId="p1">Refunds</KnowledgePageLink>
      </KnowledgeLinksProvider>,
    );
    expect(calls).toEqual([]);
    expect(screen.getByRole('link', { name: 'Refunds' }).getAttribute('href')).toBe('/k?page=p1');
  });

  it('shows name, ref, child count and link counts once the link is hovered', async () => {
    render(
      <KnowledgeLinksProvider
        pageHref={id => `/k?page=${id}`}
        refHref={ref => `/k?page=${encodeURIComponent(ref)}`}
        Link={Anchor}
        usePagePreview={preview}
      >
        <KnowledgePageLink pageRef="org:acme#policies/refunds">Refunds</KnowledgePageLink>
      </KnowledgeLinksProvider>,
    );
    fireEvent.pointerEnter(screen.getByRole('link', { name: 'Refunds' }), { pointerType: 'mouse' });
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Refunds' }));
    const card = await screen.findByTestId('knowledge-link-card', undefined, { timeout: 2000 });
    expect(card.textContent).toContain('org:acme#policies/refunds');
    expect(card.textContent).toContain('3 children');
    expect(card.textContent).toContain('4 links in');
  });

  it('opens no empty card while the page is still loading', async () => {
    render(
      <KnowledgeLinksProvider pageHref={id => `/k?page=${id}`} Link={Anchor} usePagePreview={() => undefined}>
        <KnowledgePageLink pageId="p1">Refunds</KnowledgePageLink>
      </KnowledgeLinksProvider>,
    );
    fireEvent.pointerEnter(screen.getByRole('link', { name: 'Refunds' }), { pointerType: 'mouse' });
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Refunds' }));
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(screen.queryByTestId('knowledge-link-card')).toBeNull();
  });
});
