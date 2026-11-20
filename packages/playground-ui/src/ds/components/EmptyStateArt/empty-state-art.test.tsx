// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from '../EmptyState';
import { sceneByName } from './art/scenes';
import type { EmptyStateArtName } from './art/scenes';
import { EmptyStateArt } from './empty-state-art';

const art = () => document.querySelector<HTMLElement>('[data-slot="empty-state-art"]');

describe('EmptyStateArt', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    Element.prototype.getAnimations = () => [];
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the named drawing hidden from assistive tech', () => {
    render(<EmptyStateArt name="knowledge" />);
    const svg = document.querySelector('svg[data-illustration="knowledge"]');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('viewBox')).toBe(sceneByName.knowledge.viewBox);
  });

  it('draws every object at the same visual area, whatever its drawn size', () => {
    const names = Object.keys(sceneByName).filter((name): name is EmptyStateArtName => name in sceneByName);
    const areas = names.map(name => {
      cleanup();
      render(<EmptyStateArt name={name} />);
      const svg = document.querySelector('svg[data-illustration]');
      return Number(svg?.getAttribute('width')) * Number(svg?.getAttribute('height'));
    });
    for (const area of areas) expect(Math.abs(area / (150 * 150) - 1)).toBeLessThan(0.01);
  });

  it('defaults to the idle state and reflects the state it is given', () => {
    const { rerender } = render(<EmptyStateArt name="deploys" />);
    expect(art()?.dataset.state).toBe('idle');
    rerender(<EmptyStateArt name="deploys" state="failed" />);
    expect(art()?.dataset.state).toBe('failed');
  });

  it('uses the drawing hue unless one is passed', () => {
    const { rerender } = render(<EmptyStateArt name="knowledge" />);
    expect(art()?.style.getPropertyValue('--art-tint')).toBe('var(--color-brand-purple)');
    rerender(<EmptyStateArt name="knowledge" hue="green" />);
    expect(art()?.style.getPropertyValue('--art-tint')).toBe('var(--color-brand-green)');
  });

  it('gives each rendered drawing its own clip and mask ids', () => {
    render(
      <>
        <EmptyStateArt name="knowledge" />
        <EmptyStateArt name="knowledge" />
      </>,
    );
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('plays while the pointer is over its empty state and stops when it leaves', () => {
    render(
      <EmptyState
        layout="split"
        titleSlot="Give your agents shared knowledge"
        iconSlot={<EmptyStateArt name="knowledge" />}
      />,
    );
    const host = document.querySelector('[data-slot="empty-state"]');
    if (!host) throw new Error('missing empty state');
    fireEvent.pointerEnter(host);
    expect(art()?.hasAttribute('data-live')).toBe(true);
    fireEvent.pointerLeave(host);
    expect(art()?.hasAttribute('data-live')).toBe(false);
  });
});

describe('EmptyState split layout', () => {
  afterEach(cleanup);

  it('renders the status line after the actions', () => {
    render(
      <EmptyState
        layout="split"
        titleSlot="Importing your first pages"
        actionSlot={<button type="button">View importer</button>}
        statusSlot="Importing from Notion, 1,284 pages so far"
      />,
    );
    const button = screen.getByRole('button', { name: 'View importer' });
    const status = screen.getByText('Importing from Notion, 1,284 pages so far');
    expect(button.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelector('[data-slot="empty-state"]')?.getAttribute('data-layout')).toBe('split');
  });
});
