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

const firePointerEvent = (
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  init: Record<string, number>,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.entries(init).forEach(([key, value]) => {
    Object.defineProperty(event, key, { value });
  });

  fireEvent(element, event);
};

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

    const backdrop = document.querySelector('[data-slot="drawer-backdrop"]');
    expect(backdrop).toBeDefined();
    expect(backdrop?.getAttribute('data-overlay')).toBe('visible');
    expect(backdrop?.classList.contains('bg-overlay')).toBe(true);
    expect(backdrop?.classList.contains('backdrop-blur-xs')).toBe(true);
    expect(document.querySelector('[data-slot="drawer-viewport"]')).toBeDefined();
    expect(document.querySelector('[data-slot="drawer-popup"]')).toBeDefined();
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeDefined();
  });

  it('renders a built-in close button by default', () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer defaultOpen onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerTitle>Closable drawer</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('can hide the built-in close button', () => {
    render(
      <Drawer defaultOpen>
        <DrawerContent showCloseButton={false}>
          <DrawerTitle>No close icon</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
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
    expect(document.querySelector('[data-slot="drawer-overlay-dismiss-layer"]')).toBeNull();
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

  it('renders a native drag handle outside interactive content for floating side drawers', () => {
    render(
      <Drawer side="right" variant="floating" defaultOpen>
        <DrawerContent>
          <DrawerTitle>Floating drawer</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    const content = document.querySelector('[data-slot="drawer-content"]');
    const sideHandle = document.querySelector('[data-slot="drawer-side-handle"]');
    expect(sideHandle).not.toBeNull();
    expect(content?.contains(sideHandle)).toBe(false);
    expect(sideHandle?.classList.contains('-left-2')).toBe(true);
    expect(sideHandle?.classList.contains('touch-none')).toBe(true);
    expect(sideHandle?.classList.contains('lg:hidden')).toBe(true);
  });

  it('renders a transparent backdrop for a floating drawer when requested', () => {
    render(
      <Drawer side="right" variant="floating" overlay="transparent" defaultOpen>
        <DrawerContent>
          <DrawerTitle>Transparent overlay drawer</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    const backdrop = document.querySelector('[data-slot="drawer-backdrop"]');
    const overlayDismissLayer = document.querySelector('[data-slot="drawer-overlay-dismiss-layer"]');
    const viewport = document.querySelector('[data-slot="drawer-viewport"]');
    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(backdrop?.getAttribute('data-overlay')).toBe('transparent');
    expect(overlayDismissLayer).not.toBeNull();
    expect(backdrop?.classList.contains('bg-transparent')).toBe(true);
    expect(backdrop?.classList.contains('bg-overlay')).toBe(false);
    expect(backdrop?.classList.contains('backdrop-blur-xs')).toBe(false);
    expect(viewport?.getAttribute('data-variant')).toBe('floating');
    expect(popup?.classList.contains('drawer-popup-floating')).toBe(true);
  });

  it('keeps visible floating overlays modal and swipe-dismissible like the default right drawer', () => {
    render(
      <Drawer side="right" variant="floating" overlay="visible" defaultOpen>
        <DrawerContent>
          <DrawerTitle>Visible overlay drawer</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    const backdrop = document.querySelector('[data-slot="drawer-backdrop"]');
    const overlayDismissLayer = document.querySelector('[data-slot="drawer-overlay-dismiss-layer"]');
    const viewport = document.querySelector('[data-slot="drawer-viewport"]');
    const popup = document.querySelector('[data-slot="drawer-popup"]');
    expect(backdrop?.getAttribute('data-overlay')).toBe('visible');
    expect(overlayDismissLayer).not.toBeNull();
    expect(backdrop?.classList.contains('bg-overlay')).toBe(true);
    expect(viewport?.classList.contains('pointer-events-none')).toBe(false);
    expect(popup?.getAttribute('data-swipe-direction')).toBe('right');
    expect(popup?.classList.contains('drawer-popup-floating')).toBe(true);
  });

  it.each(['transparent', 'visible'] as const)(
    'dismisses a floating drawer when dragging its %s overlay in the drawer swipe direction',
    overlay => {
      const onOpenChange = vi.fn();
      render(
        <Drawer side="right" variant="floating" overlay={overlay} defaultOpen onOpenChange={onOpenChange}>
          <DrawerContent>
            <DrawerTitle>Draggable overlay drawer</DrawerTitle>
          </DrawerContent>
        </Drawer>,
      );

      const overlayDismissLayer = document.querySelector('[data-slot="drawer-overlay-dismiss-layer"]');
      expect(overlayDismissLayer).not.toBeNull();

      firePointerEvent(overlayDismissLayer!, 'pointerdown', { button: 0, clientX: 120, clientY: 100, pointerId: 1 });
      firePointerEvent(overlayDismissLayer!, 'pointermove', { buttons: 1, clientX: 180, clientY: 100, pointerId: 1 });
      firePointerEvent(overlayDismissLayer!, 'pointerup', { button: 0, clientX: 180, clientY: 100, pointerId: 1 });

      expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    },
  );

  it('does not treat a short overlay drag as an outside click dismissal', () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer side="right" variant="floating" overlay="transparent" defaultOpen onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerTitle>Short drag overlay drawer</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    const overlayDismissLayer = document.querySelector('[data-slot="drawer-overlay-dismiss-layer"]');
    expect(overlayDismissLayer).not.toBeNull();

    firePointerEvent(overlayDismissLayer!, 'pointerdown', { button: 0, clientX: 120, clientY: 100, pointerId: 1 });
    firePointerEvent(overlayDismissLayer!, 'pointermove', { buttons: 1, clientX: 130, clientY: 100, pointerId: 1 });
    firePointerEvent(overlayDismissLayer!, 'pointerup', { button: 0, clientX: 130, clientY: 100, pointerId: 1 });
    fireEvent.click(overlayDismissLayer!);

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('keeps outside interactions from dismissing a floating drawer without an overlay', () => {
    const onOpenChange = vi.fn();
    render(
      <>
        <button type="button">Behind surface</button>
        <Drawer side="right" variant="floating" defaultOpen onOpenChange={onOpenChange}>
          <DrawerContent>
            <DrawerTitle>Persistent floating drawer</DrawerTitle>
          </DrawerContent>
        </Drawer>
      </>,
    );

    const behindSurface = screen.getByRole('button', { name: 'Behind surface' });
    fireEvent.pointerDown(behindSurface);
    fireEvent.click(behindSurface);
    expect(onOpenChange).not.toHaveBeenCalled();
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
    expect(document.querySelector('[data-slot="drawer-backdrop"]')?.getAttribute('data-overlay')).toBe('visible');
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
