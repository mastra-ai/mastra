// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  afterEach(cleanup);

  describe('when variant is not set', () => {
    it('renders the block in place without a fill wrapper', () => {
      render(<EmptyState iconSlot={null} titleSlot="Nothing here" />);
      expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeTruthy();
      expect(document.querySelector('[data-slot="empty-state-fill"]')).toBeNull();
    });
  });

  describe('when variant is fill', () => {
    it('wraps the block in a full-height centered container', () => {
      render(<EmptyState iconSlot={null} titleSlot="Nothing here" variant="fill" />);
      const wrapper = document.querySelector('[data-slot="empty-state-fill"]');
      expect(wrapper?.className).toContain('h-full');
      expect(wrapper?.className).toContain('items-center-safe');
      expect(wrapper?.className).toContain('justify-center-safe');
      expect(wrapper?.contains(screen.getByRole('heading', { name: 'Nothing here' }))).toBe(true);
    });
  });
});

describe('EmptyState illustration', () => {
  afterEach(cleanup);

  it('renders the named illustration instead of the icon, hidden from assistive tech', () => {
    render(<EmptyState illustration="logs" titleSlot="No logs yet" />);
    const art = document.querySelector('svg[data-illustration="logs"]');
    expect(art?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelectorAll('svg')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'No logs yet' })).toBeTruthy();
  });

  it('gives each rendered illustration its own mask and gradient ids', () => {
    render(
      <>
        <EmptyState illustration="api-keys" titleSlot="First" />
        <EmptyState illustration="api-keys" titleSlot="Second" />
      </>,
    );
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const element of document.querySelectorAll('[mask], [fill^="url("]')) {
      const reference = (element.getAttribute('mask') ?? element.getAttribute('fill'))?.match(/url\(#(.+)\)/)?.[1];
      expect(reference && ids.includes(reference)).toBe(true);
    }
  });
});
