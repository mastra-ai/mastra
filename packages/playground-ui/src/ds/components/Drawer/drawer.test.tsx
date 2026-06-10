// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
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
          <DrawerContent>
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
          </DrawerContent>
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
        <DrawerContent>
          <DrawerTitle>Title</DrawerTitle>
        </DrawerContent>
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
        <DrawerContent>
          <DrawerTitle>Revealed title</DrawerTitle>
        </DrawerContent>
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
        <DrawerContent>
          <DrawerTitle>Title</DrawerTitle>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('maps the `side` prop to the matching Base UI swipe direction', () => {
    render(
      <Drawer side="right" defaultOpen>
        <DrawerContent>
          <DrawerTitle>Right drawer</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(popup?.getAttribute('data-swipe-direction')).toBe('right');
  });

  it('renders the Portal + Backdrop + Viewport + Popup bundle for `DrawerContent`', () => {
    render(
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerTitle>Bundle</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    expect(document.querySelector('[data-slot="drawer-backdrop"]')).toBeDefined();
    expect(document.querySelector('[data-slot="drawer-viewport"]')).toBeDefined();
    expect(document.querySelector('[data-slot="drawer-popup"]')).toBeDefined();
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeDefined();
  });

  it('renders a handle bar on bottom-anchored drawers', () => {
    render(
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerTitle>Bottom</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    expect(document.querySelector('[data-slot="drawer-handle"]')).not.toBeNull();
  });

  it('omits the handle bar on side-anchored drawers', () => {
    render(
      <Drawer side="right" defaultOpen>
        <DrawerContent>
          <DrawerTitle>Right</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    expect(document.querySelector('[data-slot="drawer-handle"]')).toBeNull();
  });

  it('forwards className from `DrawerContent` onto the underlying popup', () => {
    render(
      <Drawer defaultOpen>
        <DrawerContent className="custom-popup-class">
          <DrawerTitle>Styled</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(popup?.classList.contains('custom-popup-class')).toBe(true);
  });

  // Regression: modal viewport must keep pointer events or the swipe-to-dismiss gesture dies.
  it('keeps pointer events on the viewport for a modal drawer', () => {
    render(
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerTitle>Modal drawer</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    const viewport = document.querySelector('[data-slot="drawer-viewport"]');
    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(viewport?.classList.contains('pointer-events-none')).toBe(false);
    expect(popup?.classList.contains('pointer-events-auto')).toBe(false);
  });

  it('renders a floating drawer without a backdrop', () => {
    render(
      <Drawer side="right" variant="floating" defaultOpen>
        <DrawerContent>
          <DrawerTitle>Floating drawer</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    const viewport = document.querySelector('[data-slot="drawer-viewport"]');
    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(document.querySelector('[data-slot="drawer-backdrop"]')).toBeNull();
    expect(viewport?.getAttribute('data-variant')).toBe('floating');
    expect(viewport?.classList.contains('pointer-events-none')).toBe(false);
    expect(viewport?.classList.contains('p-3')).toBe(true);
    expect(viewport?.classList.contains('right-0')).toBe(true);
    expect(viewport?.classList.contains('w-[calc(32rem+1.5rem)]')).toBe(true);
    expect(popup?.getAttribute('data-variant')).toBe('floating');
    expect(popup?.classList.contains('drawer-popup-floating')).toBe(true);
    expect(popup?.classList.contains('pointer-events-auto')).toBe(true);
    expect(popup?.classList.contains('w-[32rem]')).toBe(true);
  });

  it('supports the floating variant on DrawerContent without changing the root', () => {
    render(
      <Drawer side="right" defaultOpen>
        <DrawerContent variant="floating">
          <DrawerTitle>Floating content</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    const viewport = document.querySelector('[data-slot="drawer-viewport"]');
    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(document.querySelector('[data-slot="drawer-backdrop"]')).toBeNull();
    expect(viewport?.getAttribute('data-variant')).toBe('floating');
    expect(popup?.getAttribute('data-variant')).toBe('floating');
  });

  // Non-modal escape hatch: viewport opts out of pointer events, popup opts back in, no backdrop.
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
