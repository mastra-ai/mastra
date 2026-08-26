import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AppShell } from '../AppShell';

afterEach(() => {
  cleanup();
});

// jsdom has no layout engine, so the frame's contract is only assertable through
// the classes that carry it.
describe.each(['document', 'viewport'] as const)('%s scroll', scroll => {
  it('renders the sidebar, header, and content inside the main surface', () => {
    render(
      <AppShell scroll={scroll} sidebar={<div>sidebar-slot</div>} header={<div>header-slot</div>}>
        <div>content-slot</div>
      </AppShell>,
    );

    expect(screen.getByText('sidebar-slot')).toBeTruthy();
    expect(screen.getByText('header-slot')).toBeTruthy();
    expect(screen.getByRole('main').textContent).toContain('content-slot');
  });

  it('isolates the content surface into its own stacking context', () => {
    render(
      <AppShell scroll={scroll} sidebar={<div>sidebar-slot</div>} header={<div>header-slot</div>}>
        <div>content-slot</div>
      </AppShell>,
    );

    expect(screen.getByRole('main').className).toContain('isolate');
  });

  it('renders the content surface when the header slot is omitted', () => {
    render(
      <AppShell scroll={scroll} sidebar={<div>sidebar-slot</div>}>
        <div>content-slot</div>
      </AppShell>,
    );

    expect(screen.getByRole('main').textContent).toContain('content-slot');
  });

  it('never clips or scrolls the frame itself', () => {
    const { container } = render(
      <AppShell scroll={scroll} sidebar={<div>sidebar-slot</div>} header={<div>header-slot</div>}>
        <div>content-slot</div>
      </AppShell>,
    );

    for (const element of container.querySelectorAll('div, aside, main')) {
      expect(element.className).not.toMatch(/overflow-(hidden|auto|scroll)/);
    }
  });
});

describe('document scroll', () => {
  it('keeps the header pinned while the page scrolls under it', () => {
    render(
      <AppShell scroll="document" sidebar={<div>sidebar-slot</div>} header={<div>header-slot</div>}>
        <div>content-slot</div>
      </AppShell>,
    );

    const headerFrame = screen.getByText('header-slot').parentElement;
    expect(headerFrame?.hasAttribute('data-page-header')).toBe(true);
    expect(headerFrame?.className).toContain('sticky');
  });
});

describe('viewport scroll', () => {
  it('lets the content own the scrolling by keeping the main surface shrinkable', () => {
    render(
      <AppShell scroll="viewport" sidebar={<div>sidebar-slot</div>} header={<div>header-slot</div>}>
        <div>content-slot</div>
      </AppShell>,
    );

    expect(screen.getByRole('main').className).toContain('min-h-0');
  });
});
