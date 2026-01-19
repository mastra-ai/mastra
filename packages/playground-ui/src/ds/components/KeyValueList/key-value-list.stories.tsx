import type { Meta, StoryObj } from '@storybook/react-vite';
import { KeyValueList } from './key-value-list';
import { BrainIcon, WorkflowIcon, UserIcon, TagIcon } from 'lucide-react';

const meta: Meta<typeof KeyValueList> = {
  title: 'Elements/KeyValueList',
  component: KeyValueList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    labelsAreHidden: {
      control: { type: 'boolean' },
    },
    isLoading: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof KeyValueList>;

const sampleData = [
  {
    key: 'tools',
    label: 'Tools',
    value: '3 tools',
    icon: <BrainIcon />,
  },
  {
    key: 'agents',
    label: 'Agents',
    value: '2 agents',
    icon: <UserIcon />,
  },
  {
    key: 'workflows',
    label: 'Workflows',
    value: '1 workflow',
    icon: <WorkflowIcon />,
  },
  {
    key: 'tags',
    label: 'Tags',
    value: 'AI, Automation, Productivity',
    icon: <TagIcon />,
  },
];

const complexData = [
  {
    key: 'tools',
    label: 'Tools',
    value: [
      { id: '1', name: 'Web Search', path: '/tools/web-search' },
      { id: '2', name: 'File System', path: '/tools/file-system' },
      { id: '3', name: 'Database', path: '/tools/database' },
    ],
    icon: <BrainIcon />,
  },
  {
    key: 'agents',
    label: 'Agents',
    value: [
      { id: '1', name: 'Research Agent', path: '/agents/research' },
      { id: '2', name: 'Writing Agent', path: '/agents/writing' },
    ],
    icon: <UserIcon />,
  },
  {
    key: 'workflows',
    label: 'Workflows',
    value: [{ id: '1', name: 'Content Creation', path: '/workflows/content' }],
    icon: <WorkflowIcon />,
  },
];

const emptyData = [
  {
    key: 'tools',
    label: 'Tools',
    value: '',
    icon: <BrainIcon />,
  },
  {
    key: 'agents',
    label: 'Agents',
    value: null,
    icon: <UserIcon />,
  },
];

export const Default: Story = {
  args: {
    data: sampleData,
  },
};

export const WithLinks: Story = {
  args: {
    data: complexData,
  },
};

export const EmptyValues: Story = {
  args: {
    data: emptyData,
  },
};

export const Loading: Story = {
  args: {
    data: sampleData,
    isLoading: true,
  },
};

export const HiddenLabels: Story = {
  args: {
    data: sampleData,
    labelsAreHidden: true,
  },
};

export const CustomClassName: Story = {
  args: {
    data: sampleData,
    className: 'bg-surface2 p-4 rounded-lg',
  },
};

export const SingleItem: Story = {
  args: {
    data: [sampleData[0]],
  },
};
