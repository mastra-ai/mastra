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
  DrawerTitle,
  DrawerTrigger,
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

  it('fires onOpenChange when the built-in close button is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer defaultOpen onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerTitle>Title</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
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
});
