import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './skeleton';
import { SkeletonText } from './skeleton-text';

const meta: Meta<typeof Skeleton> = {
  title: 'Elements/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: {
    className: 'h-4 w-[200px]',
  },
};

export const Circle: Story = {
  args: {
    className: 'h-12 w-12 rounded-full',
  },
};

export const Card: Story = {
  render: () => (
    <div className="flex w-75 flex-col gap-3 rounded-lg border border-border p-4">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  ),
};

export const ListItem: Story = {
  render: () => (
    <div className="flex w-75 items-center gap-3 p-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  ),
};

export const TableRows: Story = {
  render: () => (
    <div className="flex w-100 flex-col gap-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-25" />
          <Skeleton className="h-4 w-[150px]" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  ),
};

export const TextBlock: Story = {
  render: () => (
    <div className="flex w-75 flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  ),
};

/** Skeletons inside lines of text take the text's line height, so nothing moves when it arrives. */
export const InTextLines: Story = {
  render: () => (
    <div className="flex w-75 flex-col">
      <SkeletonText line="text-body" className="h-4 w-24" />
      <SkeletonText className="w-40" />
      <SkeletonText className="w-32" />
    </div>
  ),
};
