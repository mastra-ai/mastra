// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer';
import { DrawerShell } from './drawer-shell';
import { Button } from '@/ds/components/Button';

afterEach(() => {
  cleanup();
});

describe('Drawer', () => {
  it('mounts every drawer part inside an open drawer without throwing', () => {
    expect(() =>
      render(
        <Drawer defaultOpen>
          <DrawerTrigger>Open</DrawerTrigger>
          <DrawerShell>
            <DrawerHeader>
              <DrawerTitle>Title</DrawerTitle>
              <DrawerDescription>Description</DrawerDescription>
            </DrawerHeader>
            <DrawerBody>Body content</DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerShell>
        </Drawer>,
      ),
    ).not.toThrow();

    expect(screen.getByRole('heading', { name: 'Title' })).toBeDefined();
    expect(screen.getByText('Body content')).toBeDefined();
  });

  it('renders an asChild Trigger as the child element without nesting buttons', () => {
    render(
      <Drawer>
        <DrawerTrigger asChild>
          <Button>Open drawer</Button>
        </DrawerTrigger>
        <DrawerShell>
          <DrawerTitle>Title</DrawerTitle>
        </DrawerShell>
      </Drawer>,
    );

    const trigger = screen.getByRole('button', { name: 'Open drawer' });
    expect(trigger.querySelector('button')).toBeNull();
  });

  it('opens the drawer when the trigger is clicked', () => {
    render(
      <Drawer>
        <DrawerTrigger asChild>
          <Button>Open drawer</Button>
        </DrawerTrigger>
        <DrawerShell>
          <DrawerTitle>Revealed title</DrawerTitle>
        </DrawerShell>
      </Drawer>,
    );

    expect(screen.queryByText('Revealed title')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open drawer' }));
    expect(screen.getByText('Revealed title')).toBeDefined();
  });

  it('fires onOpenChange when the built-in close button is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer defaultOpen onOpenChange={onOpenChange}>
        <DrawerShell>
          <DrawerTitle>Title</DrawerTitle>
        </DrawerShell>
      </Drawer>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('fires onOpenChange when an asChild DrawerClose is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer defaultOpen onOpenChange={onOpenChange}>
        <DrawerShell>
          <DrawerTitle>Title</DrawerTitle>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerShell>
      </Drawer>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('maps the `side` prop to the matching Base UI swipe direction', () => {
    render(
      <Drawer side="right" defaultOpen>
        <DrawerShell>
          <DrawerTitle>Right drawer</DrawerTitle>
        </DrawerShell>
      </Drawer>,
    );

    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(popup?.getAttribute('data-swipe-direction')).toBe('right');
  });

  // Regression guard: a modal drawer's viewport must not carry `pointer-events-none`.
  // Base UI applies that only to non-modal drawers; on a modal drawer it swallows the
  // pointer stream and the swipe-to-dismiss gesture stops working.
  it('keeps pointer events on the viewport for a modal drawer', () => {
    render(
      <Drawer defaultOpen>
        <DrawerShell>
          <DrawerTitle>Modal drawer</DrawerTitle>
        </DrawerShell>
      </Drawer>,
    );

    const viewport = document.querySelector('[data-slot="drawer-viewport"]');
    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(viewport?.classList.contains('pointer-events-none')).toBe(false);
    expect(popup?.classList.contains('pointer-events-auto')).toBe(false);
  });

  // Regression guard: a non-modal drawer (`hideBackdrop`) must opt the viewport out of
  // pointer events so the page behind stays interactive, with the popup re-enabling
  // its own — and it must not render a backdrop.
  it('opts the viewport out of pointer events for a non-modal drawer', () => {
    render(
      <Drawer defaultOpen>
        <DrawerShell hideBackdrop>
          <DrawerTitle>Non-modal drawer</DrawerTitle>
        </DrawerShell>
      </Drawer>,
    );

    const viewport = document.querySelector('[data-slot="drawer-viewport"]');
    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(viewport?.classList.contains('pointer-events-none')).toBe(true);
    expect(popup?.classList.contains('pointer-events-auto')).toBe(true);
    expect(document.querySelector('[data-slot="drawer-backdrop"]')).toBeNull();
  });
});
