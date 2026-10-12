import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckIcon } from 'lucide-react';
import { DropdownMenu } from '../DropdownMenu/dropdown-menu';
import { Avatar } from './Avatar';
import { focusRingOffset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const meta: Meta<typeof Avatar> = {
  title: 'Elements/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

const people = {
  jane: {
    name: 'Jane Smith',
    initials: 'JS',
    src: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
  },
  sam: {
    name: 'Sam Lee',
    initials: 'SL',
    src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
  },
  alex: {
    name: 'Alex Morgan',
    initials: 'AM',
    src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
  },
};

const mastraLogo = 'https://app.paper.design/file-assets/01M3ZEJQE1FBY8QS12PDAP7EAD/2HJ0BRDHF4SC53J60Z9SPYRCWJ.svg';

export const Basic: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Avatar size="md">
        <Avatar.Image src={people.alex.src} alt={people.alex.name} />
        <Avatar.Fallback>{people.alex.initials}</Avatar.Fallback>
      </Avatar>
      <Avatar size="md">
        <Avatar.Image src="https://example.invalid/missing.png" alt={people.sam.name} />
        <Avatar.Fallback>{people.sam.initials}</Avatar.Fallback>
      </Avatar>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      {(['xs', 'sm', 'control', 'md', 'lg'] as const).map(size => (
        <Avatar key={size} size={size}>
          <Avatar.Image src={people.alex.src} alt={`${people.alex.name}, ${size}`} />
          <Avatar.Fallback>{people.alex.initials}</Avatar.Fallback>
        </Avatar>
      ))}
    </div>
  ),
};

export const Badge: Story = {
  render: () => (
    <Avatar size="md">
      <Avatar.Image src={people.sam.src} alt={people.sam.name} />
      <Avatar.Fallback>{people.sam.initials}</Avatar.Fallback>
      <Avatar.Badge tone="success" />
    </Avatar>
  ),
};

export const BadgeWithIcon: Story = {
  render: () => (
    <Avatar size="lg">
      <Avatar.Image src={people.sam.src} alt={people.sam.name} />
      <Avatar.Fallback>{people.sam.initials}</Avatar.Fallback>
      <Avatar.Badge tone="success">
        <CheckIcon />
      </Avatar.Badge>
    </Avatar>
  ),
};

export const WithOrganization: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Avatar size="md">
        <Avatar.Image src={people.alex.src} alt={people.alex.name} />
        <Avatar.Fallback>{people.alex.initials}</Avatar.Fallback>
        <Avatar.Badge>
          <Avatar name="Mastra" src={mastraLogo} />
        </Avatar.Badge>
      </Avatar>
      <Avatar size="md">
        <Avatar.Fallback>{people.alex.initials}</Avatar.Fallback>
        <Avatar.Badge>
          <Avatar name="Acme" />
        </Avatar.Badge>
      </Avatar>
    </div>
  ),
};

export const Group: Story = {
  render: () => (
    <Avatar.Group size="md">
      {Object.values(people).map(person => (
        <Avatar key={person.name}>
          <Avatar.Image src={person.src} alt={person.name} />
          <Avatar.Fallback>{person.initials}</Avatar.Fallback>
        </Avatar>
      ))}
    </Avatar.Group>
  ),
};

export const GroupCount: Story = {
  render: () => (
    <Avatar.Group size="md">
      {Object.values(people).map(person => (
        <Avatar key={person.name}>
          <Avatar.Image src={person.src} alt={person.name} />
          <Avatar.Fallback>{person.initials}</Avatar.Fallback>
        </Avatar>
      ))}
      <Avatar.GroupCount>+3</Avatar.GroupCount>
    </Avatar.Group>
  ),
};

export const Dropdown: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger
        aria-label={`${people.alex.name} menu`}
        render={<button type="button" className={cn('cursor-pointer rounded-full', focusRingOffset)} />}
      >
        <Avatar size="md">
          <Avatar.Image src={people.alex.src} alt="" />
          <Avatar.Fallback>{people.alex.initials}</Avatar.Fallback>
        </Avatar>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item>Profile</DropdownMenu.Item>
        <DropdownMenu.Item>Settings</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>Log out</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};

export const FromName: Story = {
  args: {
    name: people.jane.name,
    src: people.jane.src,
    size: 'md',
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'control', 'md', 'lg'],
    },
  },
};

export const OnSurfaces: Story = {
  render: () => (
    <div className="flex gap-2">
      {[
        { label: 'Card', surface: 'bg-card' },
        { label: 'Canvas', surface: 'bg-background' },
        { label: 'Sidebar', surface: 'bg-sidebar' },
      ].map(({ label, surface }) => (
        <div key={label} className={cn('flex flex-col items-center gap-4 rounded-xl px-8 py-6', surface)}>
          <Avatar size="md">
            <Avatar.Image src={people.alex.src} alt={people.alex.name} />
            <Avatar.Fallback>{people.alex.initials}</Avatar.Fallback>
            <Avatar.Badge>
              <Avatar name="Mastra" src={mastraLogo} />
            </Avatar.Badge>
          </Avatar>
          <span className="text-caption text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  ),
};
