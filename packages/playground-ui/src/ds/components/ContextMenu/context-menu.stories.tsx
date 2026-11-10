import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ContextMenu } from './context-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { IconArrowBoxLeft } from '@/ds/icons/central/IconArrowBoxLeft';
import { IconBubble2 } from '@/ds/icons/central/IconBubble2';
import { IconCloud } from '@/ds/icons/central/IconCloud';
import { IconCreditCard1 } from '@/ds/icons/central/IconCreditCard1';
import { IconEmail1 } from '@/ds/icons/central/IconEmail1';
import { IconPlusLarge } from '@/ds/icons/central/IconPlusLarge';
import { IconRescueRing } from '@/ds/icons/central/IconRescueRing';
import { IconSettingsGear1 } from '@/ds/icons/central/IconSettingsGear1';
import { IconTrashCan } from '@/ds/icons/central/IconTrashCan';
import { IconUser } from '@/ds/icons/central/IconUser';
import { IconUserAdd } from '@/ds/icons/central/IconUserAdd';
import { IconUserDuo } from '@/ds/icons/central/IconUserDuo';
import { cn } from '@/lib/utils';

const meta: Meta<typeof ContextMenu> = {
  title: 'Elements/ContextMenu',
  component: ContextMenu,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Right-click or long-press to open the app menu. Right-click again while it is open to dismiss it and use the browser’s native context menu.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ContextMenu>;

const triggerClass =
  'flex items-center justify-center w-80 h-60 rounded-md border border-dashed border-border text-muted-foreground select-none text-body-sm';

export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenu.Trigger className={triggerClass}>Right click here</ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item>Profile</ContextMenu.Item>
        <ContextMenu.Item>Settings</ContextMenu.Item>
        <ContextMenu.Item>Billing</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item>Log out</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  ),
};

/** A long menu scrolls inside the popup; the scrollbar stays clear of the rounded corners. */
export const WithManyItems: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenu.Trigger className={triggerClass}>Right click here</ContextMenu.Trigger>
      <ContextMenu.Content className="w-56">
        <ContextMenu.Label>Many items</ContextMenu.Label>
        {Array.from({ length: 30 }, (_, i) => (
          <ContextMenu.Item key={i}>Item {i + 1}</ContextMenu.Item>
        ))}
      </ContextMenu.Content>
    </ContextMenu>
  ),
};

export const WithIconsAndShortcuts: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenu.Trigger className={triggerClass}>Right click here</ContextMenu.Trigger>
      <ContextMenu.Content className="w-56">
        <ContextMenu.Group>
          <ContextMenu.Label>My Account</ContextMenu.Label>
          <ContextMenu.Item>
            <IconUser />
            <span>Profile</span>
            <ContextMenu.Shortcut>Ctrl+P</ContextMenu.Shortcut>
          </ContextMenu.Item>
          <ContextMenu.Item>
            <IconCreditCard1 />
            <span>Billing</span>
            <ContextMenu.Shortcut>Ctrl+B</ContextMenu.Shortcut>
          </ContextMenu.Item>
          <ContextMenu.Item>
            <IconSettingsGear1 />
            <span>Settings</span>
            <ContextMenu.Shortcut>Ctrl+S</ContextMenu.Shortcut>
          </ContextMenu.Item>
        </ContextMenu.Group>
        <ContextMenu.Separator />
        <ContextMenu.Group>
          <ContextMenu.Label>Team</ContextMenu.Label>
          <ContextMenu.Item>
            <IconUserDuo />
            <span>Team</span>
          </ContextMenu.Item>
          <ContextMenu.Item>
            <IconUserAdd />
            <span>Invite users</span>
          </ContextMenu.Item>
        </ContextMenu.Group>
        <ContextMenu.Separator />
        <ContextMenu.Item>
          <IconArrowBoxLeft />
          <span>Log out</span>
          <ContextMenu.Shortcut>Ctrl+Q</ContextMenu.Shortcut>
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  ),
};

export const WithCheckboxItems: Story = {
  render: function Render() {
    const [showStatusBar, setShowStatusBar] = useState(true);
    const [showActivityBar, setShowActivityBar] = useState(false);
    const [showPanel, setShowPanel] = useState(false);

    return (
      <ContextMenu>
        <ContextMenu.Trigger className={triggerClass}>Right click here</ContextMenu.Trigger>
        <ContextMenu.Content className="w-56">
          <ContextMenu.Label>Appearance</ContextMenu.Label>
          <ContextMenu.Separator />
          <ContextMenu.CheckboxItem checked={showStatusBar} onCheckedChange={setShowStatusBar}>
            Status bar
          </ContextMenu.CheckboxItem>
          <ContextMenu.CheckboxItem checked={showActivityBar} onCheckedChange={setShowActivityBar}>
            Activity bar
          </ContextMenu.CheckboxItem>
          <ContextMenu.CheckboxItem checked={showPanel} onCheckedChange={setShowPanel}>
            Panel
          </ContextMenu.CheckboxItem>
        </ContextMenu.Content>
      </ContextMenu>
    );
  },
};

export const WithRadioItems: Story = {
  render: function Render() {
    const [position, setPosition] = useState('bottom');

    return (
      <ContextMenu>
        <ContextMenu.Trigger className={triggerClass}>Right click here</ContextMenu.Trigger>
        <ContextMenu.Content className="w-56">
          <ContextMenu.Label>Panel Position</ContextMenu.Label>
          <ContextMenu.Separator />
          <ContextMenu.RadioGroup value={position} onValueChange={setPosition}>
            <ContextMenu.RadioItem value="top">Top</ContextMenu.RadioItem>
            <ContextMenu.RadioItem value="bottom">Bottom</ContextMenu.RadioItem>
            <ContextMenu.RadioItem value="right">Right</ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>
        </ContextMenu.Content>
      </ContextMenu>
    );
  },
};

export const WithSubMenu: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenu.Trigger className={triggerClass}>Right click here</ContextMenu.Trigger>
      <ContextMenu.Content className="w-56">
        <ContextMenu.Item>
          <IconEmail1 />
          <span>Email</span>
        </ContextMenu.Item>
        <ContextMenu.Item>
          <IconBubble2 />
          <span>Message</span>
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Sub>
          <ContextMenu.SubTrigger>
            <IconUserAdd />
            <span>Invite users</span>
          </ContextMenu.SubTrigger>
          <ContextMenu.SubContent>
            <ContextMenu.Item>
              <IconEmail1 />
              <span>Email</span>
            </ContextMenu.Item>
            <ContextMenu.Item>
              <IconBubble2 />
              <span>Message</span>
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item>
              <IconPlusLarge />
              <span>More...</span>
            </ContextMenu.Item>
          </ContextMenu.SubContent>
        </ContextMenu.Sub>
        <ContextMenu.Separator />
        <ContextMenu.Item>
          <IconRescueRing />
          <span>Support</span>
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  ),
};

export const States: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenu.Trigger className={triggerClass}>Right click here</ContextMenu.Trigger>
      <ContextMenu.Content className="w-56">
        <ContextMenu.Item>
          <IconUser />
          <span>Default item</span>
        </ContextMenu.Item>
        <ContextMenu.Item disabled>
          <IconCloud />
          <span>Disabled item</span>
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item variant="destructive">
          <IconTrashCan />
          <span>Destructive item</span>
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  ),
};

/** Every item kind side by side, to compare against DropdownMenu / Select / Combobox. */
export const KitchenSink: Story = {
  render: () => {
    const [checked, setChecked] = useState(true);
    const [radio, setRadio] = useState('medium');
    return (
      <ContextMenu>
        <ContextMenu.Trigger className={triggerClass}>Right click here</ContextMenu.Trigger>
        <ContextMenu.Content className="w-56">
          <ContextMenu.Label>Account</ContextMenu.Label>
          <ContextMenu.Item>Plain item</ContextMenu.Item>
          <ContextMenu.Item>
            <IconUser />
            <span>With icon</span>
            <ContextMenu.Shortcut>⇧⌘P</ContextMenu.Shortcut>
          </ContextMenu.Item>
          <ContextMenu.Item disabled>
            <IconCreditCard1 />
            <span>Disabled</span>
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.CheckboxItem checked={checked} onCheckedChange={setChecked}>
            Checkbox item
          </ContextMenu.CheckboxItem>
          <ContextMenu.RadioGroup value={radio} onValueChange={setRadio}>
            <ContextMenu.RadioItem value="small">Radio small</ContextMenu.RadioItem>
            <ContextMenu.RadioItem value="medium">Radio medium</ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>
          <ContextMenu.Separator />
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger>
              <IconUserAdd />
              <span>Sub menu</span>
            </ContextMenu.SubTrigger>
            <ContextMenu.SubContent>
              <ContextMenu.Item>
                <IconEmail1 />
                <span>Email</span>
              </ContextMenu.Item>
              <ContextMenu.Item>
                <IconBubble2 />
                <span>Message</span>
              </ContextMenu.Item>
            </ContextMenu.SubContent>
          </ContextMenu.Sub>
          <ContextMenu.Separator />
          <ContextMenu.Item variant="destructive">
            <IconTrashCan />
            <span>Destructive</span>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>
    );
  },
};

/** Stacking check: a right-click menu opened inside a modal Dialog (z-50) must render above it. */
export const InsideDialog: Story = {
  render: () => (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <ContextMenu>
            <ContextMenu.Trigger className={cn(triggerClass, 'w-full')}>Right click here</ContextMenu.Trigger>
            <ContextMenu.Content>
              <ContextMenu.Item>Plain item</ContextMenu.Item>
              <ContextMenu.Item>Second item</ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu>
        </DialogBody>
      </DialogContent>
    </Dialog>
  ),
};
