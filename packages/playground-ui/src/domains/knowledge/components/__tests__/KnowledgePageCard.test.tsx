// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import { KnowledgePageCard } from '../KnowledgePageCard';

describe('KnowledgePageCard', () => {
  it('names the page with its kind and ref, how many children it has and its link counts', () => {
    const { container } = renderWithProviders(
      <KnowledgePageCard
        name="Refunds"
        kind="Page"
        pageRef="org:acme#policies/refunds"
        childCount="3"
        links={{ in: 4, out: 1 }}
      />,
    );

    const card = within(container);
    expect(card.getByText('Refunds')).toBeTruthy();
    expect(card.getByText('Page')).toBeTruthy();
    expect(card.getByText('org:acme#policies/refunds')).toBeTruthy();
    expect(card.getByText('3 children')).toBeTruthy();
    expect(card.getByText('4 links in, 1 link out')).toBeTruthy();
  });

  it('says "1 child" for one child and leaves out what is zero or unknown', () => {
    renderWithProviders(<KnowledgePageCard name="Billing" kind="Scope" childCount="1" links={{ in: 0, out: 0 }} />);

    expect(screen.getByText('1 child')).toBeTruthy();
    expect(screen.getByText('Scope')).toBeTruthy();
    expect(screen.queryByText(/links?/)).toBeNull();
  });

  it('shows a capped child count as a lower bound', () => {
    renderWithProviders(<KnowledgePageCard name="Docs" kind="Scope" childCount="1000+" />);

    expect(screen.getByText('1000+ children')).toBeTruthy();
  });
});
