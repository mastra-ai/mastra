// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { KnowledgeLinksProvider } from '../../../knowledge/knowledge-links';
import { MessageText } from '../message-text';

afterEach(cleanup);

const Anchor = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(
  (props, ref) => <a ref={ref} {...props} />,
);

const known = new Set(['docs:mastra#guides/memory']);

const renderText = (text: string, linked = true) => {
  const node = <MessageText text={text} metadata={undefined} />;
  return render(
    linked ? (
      <KnowledgeLinksProvider
        pageHref={id => `/k?page=${id}`}
        refHref={ref => `/k?page=${encodeURIComponent(ref)}`}
        Link={Anchor}
        usePagePreview={({ pageRef }) =>
          pageRef && known.has(pageRef) ? { name: 'Memory', kind: 'Page', pageRef } : undefined
        }
      >
        {node}
      </KnowledgeLinksProvider>
    ) : (
      node
    ),
  );
};

describe('MessageText Knowledge references', () => {
  it('links [[ref]] to the page', () => {
    renderText('See [[org:acme#policies/refunds]] for details.');
    expect(screen.getByRole('link', { name: 'org:acme#policies/refunds' }).getAttribute('href')).toBe(
      '/k?page=org%3Aacme%23policies%2Frefunds',
    );
  });

  it('links a bare scope address and leaves the sentence full stop out of it', () => {
    renderText('Read docs:mastra#guides/memory.');
    const link = screen.getByRole('link', { name: 'docs:mastra#guides/memory' });
    expect(link.getAttribute('href')).toBe('/k?page=docs%3Amastra%23guides%2Fmemory');
  });

  it('does not turn URLs or inline code into page links', () => {
    renderText('Go to https://example.com/a#b or `docs:mastra#guides/memory`.');
    expect(screen.queryAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['https://example.com/a#b']);
  });

  it('leaves references as plain text when the host has no Knowledge pages', () => {
    renderText('See [[org:acme#policies/refunds]] and docs:mastra#guides/memory.', false);
    expect(screen.queryAllByRole('link')).toEqual([]);
  });

  it('leaves text that only looks like an address as text unless the page resolves', () => {
    renderText('Try localhost:3000#top, git:abc#1, c:1#2, mailto:x#y or note:2024-01-01#todo.');
    expect(screen.queryAllByRole('link')).toEqual([]);
  });

  it('links a [[ref]] without checking it resolves', () => {
    renderText('See [[localhost:3000#top]].');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
