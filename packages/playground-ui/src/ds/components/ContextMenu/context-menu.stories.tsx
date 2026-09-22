import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Cloud,
  CreditCard,
  LifeBuoy,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { ContextMenu } from './context-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { cn } from '@/lib/utils';

const meta: Meta<typeof ContextMenu> = {
  title: 'Elements/ContextMenu',
  component: ContextMenu,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ContextMenu>;

const triggerClass =
  'flex items-center justify-center w-80 h-60 rounded-md border border-dashed border-border1 text-muted-foreground select-none text-ui-smd';

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

export const WithIconsAndShortcuts: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenu.Trigger className={triggerClass}>Right click here</ContextMenu.Trigger>
      <ContextMenu.Content className="w-56">
        <ContextMenu.Group>
          <ContextMenu.Label>My Account</ContextMenu.Label>
          <ContextMenu.Item>
            <User />
            <span>Profile</span>
            <ContextMenu.Shortcut>Ctrl+P</ContextMenu.Shortcut>
          </ContextMenu.Item>
          <ContextMenu.Item>
            <CreditCard />
            <span>Billing</span>
            <ContextMenu.Shortcut>Ctrl+B</ContextMenu.Shortcut>
          </ContextMenu.Item>
          <ContextMenu.Item>
            <Settings />
            <span>Settings</span>
            <ContextMenu.Shortcut>Ctrl+S</ContextMenu.Shortcut>
          </ContextMenu.Item>
        </ContextMenu.Group>
        <ContextMenu.Separator />
        <ContextMenu.Group>
          <ContextMenu.Label>Team</ContextMenu.Label>
          <ContextMenu.Item>
            <Users />
            <span>Team</span>
          </ContextMenu.Item>
          <ContextMenu.Item>
            <UserPlus />
            <span>Invite users</span>
          </ContextMenu.Item>
        </ContextMenu.Group>
        <ContextMenu.Separator />
        <ContextMenu.Item>
          <LogOut />
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
            Status Bar
          </ContextMenu.CheckboxItem>
          <ContextMenu.CheckboxItem checked={showActivityBar} onCheckedChange={setShowActivityBar}>
            Activity Bar
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
          <Mail />
          <span>Email</span>
        </ContextMenu.Item>
        <ContextMenu.Item>
          <MessageSquare />
          <span>Message</span>
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Sub>
          <ContextMenu.SubTrigger>
            <UserPlus />
            <span>Invite users</span>
          </ContextMenu.SubTrigger>
          <ContextMenu.SubContent>
            <ContextMenu.Item>
              <Mail />
              <span>Email</span>
            </ContextMenu.Item>
            <ContextMenu.Item>
              <MessageSquare />
              <span>Message</span>
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item>
              <Plus />
              <span>More...</span>
            </ContextMenu.Item>
          </ContextMenu.SubContent>
        </ContextMenu.Sub>
        <ContextMenu.Separator />
        <ContextMenu.Item>
          <LifeBuoy />
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
          <User />
          <span>Default item</span>
        </ContextMenu.Item>
        <ContextMenu.Item disabled>
          <Cloud />
          <span>Disabled item</span>
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item variant="destructive">
          <Trash2 />
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
            <User />
            <span>With icon</span>
            <ContextMenu.Shortcut>⇧⌘P</ContextMenu.Shortcut>
          </ContextMenu.Item>
          <ContextMenu.Item disabled>
            <CreditCard />
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
              <UserPlus />
              <span>Sub menu</span>
            </ContextMenu.SubTrigger>
            <ContextMenu.SubContent>
              <ContextMenu.Item>
                <Mail />
                <span>Email</span>
              </ContextMenu.Item>
              <ContextMenu.Item>
                <MessageSquare />
                <span>Message</span>
              </ContextMenu.Item>
            </ContextMenu.SubContent>
          </ContextMenu.Sub>
          <ContextMenu.Separator />
          <ContextMenu.Item variant="destructive">
            <Trash2 />
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
