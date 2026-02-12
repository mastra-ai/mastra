import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Cloud,
  CreditCard,
  Github,
  Keyboard,
  LifeBuoy,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../Button';
import { DropdownMenu } from './dropdown-menu';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Elements/DropdownMenu',
  component: DropdownMenu,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="cta" size="default">
          Open Menu
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Profile</DropdownMenu.Item>
        <DropdownMenu.Item>Settings</DropdownMenu.Item>
        <DropdownMenu.Item>Billing</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>Log out</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline">Open Menu</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className="w-56">
        <DropdownMenu.Item>
          <User />
          <span>Profile</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          <Settings />
          <span>Settings</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          <CreditCard />
          <span>Billing</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          <Keyboard />
          <span>Keyboard shortcuts</span>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>
          <LogOut />
          <span>Log out</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};

export const WithLabelsAndGroups: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline">Open Menu</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className="w-56">
        <DropdownMenu.Label>My Account</DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.Group>
          <DropdownMenu.Item>
            <User />
            <span>Profile</span>
            <DropdownMenu.Shortcut>Ctrl+P</DropdownMenu.Shortcut>
          </DropdownMenu.Item>
          <DropdownMenu.Item>
            <CreditCard />
            <span>Billing</span>
            <DropdownMenu.Shortcut>Ctrl+B</DropdownMenu.Shortcut>
          </DropdownMenu.Item>
          <DropdownMenu.Item>
            <Settings />
            <span>Settings</span>
            <DropdownMenu.Shortcut>Ctrl+S</DropdownMenu.Shortcut>
          </DropdownMenu.Item>
        </DropdownMenu.Group>
        <DropdownMenu.Separator />
        <DropdownMenu.Group>
          <DropdownMenu.Item>
            <Users />
            <span>Team</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item>
            <UserPlus />
            <span>Invite users</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item>
            <Plus />
            <span>New Team</span>
            <DropdownMenu.Shortcut>Ctrl+T</DropdownMenu.Shortcut>
          </DropdownMenu.Item>
        </DropdownMenu.Group>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>
          <LogOut />
          <span>Log out</span>
          <DropdownMenu.Shortcut>Ctrl+Q</DropdownMenu.Shortcut>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};

export const WithCheckboxItems: Story = {
  render: function Render() {
    const [showStatusBar, setShowStatusBar] = useState(true);
    const [showActivityBar, setShowActivityBar] = useState(false);
    const [showPanel, setShowPanel] = useState(false);

    return (
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button variant="outline">View Options</Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="w-56">
          <DropdownMenu.Label>Appearance</DropdownMenu.Label>
          <DropdownMenu.Separator />
          <DropdownMenu.CheckboxItem checked={showStatusBar} onCheckedChange={setShowStatusBar}>
            Status Bar
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={showActivityBar} onCheckedChange={setShowActivityBar}>
            Activity Bar
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={showPanel} onCheckedChange={setShowPanel}>
            Panel
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
  },
};

export const WithRadioItems: Story = {
  render: function Render() {
    const [position, setPosition] = useState('bottom');

    return (
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button variant="outline">Panel Position</Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="w-56">
          <DropdownMenu.Label>Panel Position</DropdownMenu.Label>
          <DropdownMenu.Separator />
          <DropdownMenu.RadioGroup value={position} onValueChange={setPosition}>
            <DropdownMenu.RadioItem value="top">Top</DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="bottom">Bottom</DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="right">Right</DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
  },
};

export const WithSubMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline">Open Menu</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className="w-56">
        <DropdownMenu.Item>
          <Mail />
          <span>Email</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          <MessageSquare />
          <span>Message</span>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>
            <UserPlus />
            <span>Invite users</span>
          </DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            <DropdownMenu.Item>
              <Mail />
              <span>Email</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item>
              <MessageSquare />
              <span>Message</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item>
              <Plus />
              <span>More...</span>
            </DropdownMenu.Item>
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>
          <LifeBuoy />
          <span>Support</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          <Cloud />
          <span>API</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};

export const WithDisabledItems: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline">Open Menu</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className="w-56">
        <DropdownMenu.Item>
          <Github />
          <span>GitHub</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item disabled>
          <Cloud />
          <span>Deploy (coming soon)</span>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>
          <LifeBuoy />
          <span>Support</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};
