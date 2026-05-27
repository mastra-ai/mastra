// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPopup,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
  DrawerViewport,
} from './drawer';
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
          <DrawerPortal>
            <DrawerBackdrop />
            <DrawerViewport>
              <DrawerPopup>
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
              </DrawerPopup>
            </DrawerViewport>
          </DrawerPortal>
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
        <DrawerPortal>
          <DrawerBackdrop />
          <DrawerViewport>
            <DrawerPopup>
              <DrawerTitle>Title</DrawerTitle>
            </DrawerPopup>
          </DrawerViewport>
        </DrawerPortal>
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
        <DrawerPortal>
          <DrawerBackdrop />
          <DrawerViewport>
            <DrawerPopup>
              <DrawerTitle>Revealed title</DrawerTitle>
            </DrawerPopup>
          </DrawerViewport>
        </DrawerPortal>
      </Drawer>,
    );

    expect(screen.queryByText('Revealed title')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open drawer' }));
    expect(screen.getByText('Revealed title')).toBeDefined();
  });

  it('fires onOpenChange when an asChild DrawerClose is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer defaultOpen onOpenChange={onOpenChange}>
        <DrawerPortal>
          <DrawerBackdrop />
          <DrawerViewport>
            <DrawerPopup>
              <DrawerTitle>Title</DrawerTitle>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerPopup>
          </DrawerViewport>
        </DrawerPortal>
      </Drawer>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('maps the `side` prop to the matching Base UI swipe direction', () => {
    render(
      <Drawer side="right" defaultOpen>
        <DrawerPortal>
          <DrawerBackdrop />
          <DrawerViewport>
            <DrawerPopup>
              <DrawerTitle>Right drawer</DrawerTitle>
            </DrawerPopup>
          </DrawerViewport>
        </DrawerPortal>
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
        <DrawerPortal>
          <DrawerBackdrop />
          <DrawerViewport>
            <DrawerPopup>
              <DrawerTitle>Modal drawer</DrawerTitle>
            </DrawerPopup>
          </DrawerViewport>
        </DrawerPortal>
      </Drawer>,
    );

    const viewport = document.querySelector('[data-slot="drawer-viewport"]');
    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(viewport?.classList.contains('pointer-events-none')).toBe(false);
    expect(popup?.classList.contains('pointer-events-auto')).toBe(false);
  });

  // Regression guard: a non-modal drawer (no backdrop) must opt the viewport out of
  // pointer events so the page behind stays interactive, with the popup re-enabling
  // its own.
  it('opts the viewport out of pointer events for a non-modal drawer', () => {
    render(
      <Drawer defaultOpen>
        <DrawerPortal>
          <DrawerViewport className="pointer-events-none">
            <DrawerPopup className="pointer-events-auto">
              <DrawerTitle>Non-modal drawer</DrawerTitle>
            </DrawerPopup>
          </DrawerViewport>
        </DrawerPortal>
      </Drawer>,
    );

    const viewport = document.querySelector('[data-slot="drawer-viewport"]');
    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(viewport?.classList.contains('pointer-events-none')).toBe(true);
    expect(popup?.classList.contains('pointer-events-auto')).toBe(true);
    expect(document.querySelector('[data-slot="drawer-backdrop"]')).toBeNull();
  });
});
