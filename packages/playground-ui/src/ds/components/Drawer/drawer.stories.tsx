import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Button } from '../Button';
import { Input } from '../Input';
import { Label } from '../Label';
import {
  createDrawerHandle,
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPopup,
  DrawerPortal,
  DrawerSwipeArea,
  DrawerTitle,
  DrawerTrigger,
  DrawerViewport,
} from './drawer';

const meta: Meta<typeof Drawer> = {
  title: 'Feedback/Drawer',
  component: Drawer,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Drawer>;

export const Default: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Open bottom drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Notifications</DrawerTitle>
          <DrawerDescription>You are all caught up. Good job!</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <p className="text-ui-sm text-neutral4">Swipe down or press the close button to dismiss this sheet.</p>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

export const Right: Story = {
  render: () => (
    <Drawer side="right">
      <DrawerTrigger asChild>
        <Button>Open right drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Library</DrawerTitle>
          <DrawerDescription>A panel that slides in from the right edge.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <p className="text-ui-sm text-neutral4">Swipe right to dismiss, or use the close button.</p>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

export const Left: Story = {
  render: () => (
    <Drawer side="left">
      <DrawerTrigger asChild>
        <Button>Open left drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Navigation</DrawerTitle>
          <DrawerDescription>A panel that slides in from the left edge.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <p className="text-ui-sm text-neutral4">Swipe left to dismiss, or use the close button.</p>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

export const Top: Story = {
  render: () => (
    <Drawer side="top">
      <DrawerTrigger asChild>
        <Button>Open top drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Announcement</DrawerTitle>
          <DrawerDescription>A panel that slides in from the top edge.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <p className="text-ui-sm text-neutral4">Swipe up to dismiss, or use the close button.</p>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

function ControlledExample() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-ui-sm text-neutral4">
        Drawer is <span className="text-neutral6">{open ? 'open' : 'closed'}</span>
      </p>
      <Button onClick={() => setOpen(true)}>Open from outside</Button>
      <Drawer side="right" open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Controlled drawer</DrawerTitle>
            <DrawerDescription>Open state is owned by the parent component.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close from outside
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export const Controlled: Story = {
  render: () => <ControlledExample />,
};

export const WithForm: Story = {
  render: () => (
    <Drawer side="right">
      <DrawerTrigger asChild>
        <Button>Edit profile</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Edit profile</DrawerTitle>
          <DrawerDescription>Make changes to your profile. Save when you are done.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="drawer-name">Name</Label>
            <Input id="drawer-name" defaultValue="John Doe" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="drawer-username">Username</Label>
            <Input id="drawer-username" defaultValue="@johndoe" />
          </div>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
          <DrawerClose asChild>
            <Button>Save changes</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

export const Nested: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Open drawer stack</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Account</DrawerTitle>
          <DrawerDescription>Nested drawers stack on top of each other, each focus-managed.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">Security settings</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Security</DrawerTitle>
                <DrawerDescription>Review sign-in activity and update your preferences.</DrawerDescription>
              </DrawerHeader>
              <DrawerBody>
                <ul className="list-disc pl-5 text-ui-sm text-neutral4">
                  <li>Passkeys enabled</li>
                  <li>2FA via authenticator app</li>
                  <li>3 signed-in devices</li>
                </ul>
                <div className="mt-4">
                  <Drawer>
                    <DrawerTrigger asChild>
                      <Button variant="outline">Advanced options</Button>
                    </DrawerTrigger>
                    <DrawerContent>
                      <DrawerHeader>
                        <DrawerTitle>Advanced</DrawerTitle>
                        <DrawerDescription>A third level to demonstrate deep nesting.</DrawerDescription>
                      </DrawerHeader>
                      <DrawerBody className="grid gap-1.5">
                        <Label htmlFor="drawer-device">Device name</Label>
                        <Input id="drawer-device" defaultValue="Personal laptop" />
                      </DrawerBody>
                      <DrawerFooter>
                        <DrawerClose asChild>
                          <Button>Done</Button>
                        </DrawerClose>
                      </DrawerFooter>
                    </DrawerContent>
                  </Drawer>
                </div>
              </DrawerBody>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">Close</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

const snapPoints = ['16rem', 1];

export const SnapPoints: Story = {
  render: () => (
    <Drawer snapPoints={snapPoints}>
      <DrawerTrigger asChild>
        <Button>Open snap drawer</Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[calc(100dvh-3rem)]">
        <DrawerHeader>
          <DrawerTitle>Snap points</DrawerTitle>
          <DrawerDescription>Drag the sheet to snap between a compact peek and full height.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="grid gap-3">
          {Array.from({ length: 16 }, (_, index) => (
            <div key={index} className="h-12 shrink-0 rounded-md bg-surface4" />
          ))}
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

// Escape hatch: no backdrop + viewport opts out of pointer events.
export const NonModal: Story = {
  render: () => (
    <Drawer side="right" modal={false} disablePointerDismissal>
      <DrawerTrigger asChild>
        <Button>Open non-modal drawer</Button>
      </DrawerTrigger>
      <DrawerPortal>
        <DrawerViewport className="pointer-events-none">
          <DrawerPopup className="pointer-events-auto">
            <DrawerHeader>
              <DrawerTitle>Non-modal drawer</DrawerTitle>
              <DrawerDescription>
                Does not trap focus or dim the page. Outside clicks are ignored — use the close button.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerPopup>
        </DrawerViewport>
      </DrawerPortal>
    </Drawer>
  ),
};

// Escape hatch: portal scoped to a parent box instead of `document.body`.
function SwipeToOpenExample() {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);

  return (
    <div ref={setContainer} className="relative h-80 w-96 overflow-hidden rounded-xl border border-border1 bg-surface2">
      <Drawer side="right" modal={false}>
        <DrawerSwipeArea className="absolute inset-y-0 right-0 z-10 w-10 border-l border-dashed border-border2 bg-surface4/40" />
        <div className="flex h-full items-center justify-center px-12 text-center">
          <p className="text-ui-sm text-neutral3">Swipe from the right edge to open the drawer.</p>
        </div>
        <DrawerPortal container={container}>
          <DrawerBackdrop className="absolute" />
          <DrawerViewport className="absolute">
            <DrawerPopup className="h-full w-3/4 max-w-xs">
              <DrawerHeader>
                <DrawerTitle>Library</DrawerTitle>
                <DrawerDescription>Swipe from the edge to jump back into your playlists.</DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">Close</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerPopup>
          </DrawerViewport>
        </DrawerPortal>
      </Drawer>
    </div>
  );
}

export const SwipeToOpen: Story = {
  render: () => <SwipeToOpenExample />,
};

const actionSheetActions = ['Unfollow', 'Mute', 'Add to favourites', 'Restrict'];

function ActionSheetExample() {
  const [open, setOpen] = React.useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button>Open action sheet</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="sr-only">
          <DrawerTitle>Profile actions</DrawerTitle>
          <DrawerDescription>Choose an action for this user.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col py-1">
          {actionSheetActions.map(action => (
            <Button
              key={action}
              variant="ghost"
              className="w-full justify-center rounded-none"
              onClick={() => setOpen(false)}
            >
              {action}
            </Button>
          ))}
        </div>
        <DrawerFooter className="border-t border-border1">
          <Button
            variant="ghost"
            className="w-full justify-center rounded-none text-negative1"
            onClick={() => setOpen(false)}
          >
            Block user
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export const ActionSheet: Story = {
  render: () => <ActionSheetExample />,
};

const navLinks = [
  'Overview',
  'Components',
  'Utilities',
  'Releases',
  'Accordion',
  'Alert Dialog',
  'Autocomplete',
  'Avatar',
  'Button',
  'Checkbox',
  'Collapsible',
  'Combobox',
  'Context Menu',
  'Dialog',
  'Drawer',
  'Field',
  'Form',
  'Input',
  'Menu',
  'Popover',
  'Progress',
  'Radio',
  'Select',
  'Slider',
  'Switch',
  'Tabs',
  'Toast',
  'Tooltip',
];

export const MobileNavigation: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Open mobile menu</Button>
      </DrawerTrigger>
      <DrawerContent className="mb-0 h-full max-h-full rounded-none pb-0">
        <DrawerHeader>
          <DrawerTitle>Menu</DrawerTitle>
          <DrawerDescription>Scroll the long list. Swipe down to dismiss.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <ul className="grid gap-1">
            {navLinks.map(label => (
              <li key={label}>
                <Button variant="ghost" className="w-full justify-start">
                  {label}
                </Button>
              </li>
            ))}
          </ul>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  ),
};

type ProfilePayload = { title: string; description: string };

const profileDrawer = createDrawerHandle<ProfilePayload>();

function DetachedTriggersExample() {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-ui-sm text-neutral4">Triggers live outside the drawer and pass it a payload.</p>
      <div className="flex gap-2">
        <DrawerTrigger
          handle={profileDrawer}
          payload={{ title: 'Profile', description: 'Your public profile details.' }}
          asChild
        >
          <Button>Profile</Button>
        </DrawerTrigger>
        <DrawerTrigger
          handle={profileDrawer}
          payload={{ title: 'Settings', description: 'Manage your workspace settings.' }}
          asChild
        >
          <Button variant="outline">Settings</Button>
        </DrawerTrigger>
      </div>
      <Drawer side="right" handle={profileDrawer}>
        {({ payload }) => (
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{payload?.title ?? 'Drawer'}</DrawerTitle>
              <DrawerDescription>{payload?.description}</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        )}
      </Drawer>
    </div>
  );
}

export const DetachedTriggers: Story = {
  render: () => <DetachedTriggersExample />,
};
