import type { Meta, StoryObj } from '@storybook/react-vite';
import { MainContentLayout, MainContentContent } from './main-content';
import { PageHeader } from '../PageHeader';

const meta: Meta<typeof MainContentLayout> = {
  title: 'Layout/MainContent',
  component: MainContentLayout,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MainContentLayout>;

export const Default: Story = {
  render: () => (
    <MainContentLayout className="h-[400px] bg-surface1">
      <PageHeader title="Page Title" description="This is the page description" />
      <MainContentContent>
        <div className="p-4">
          <p className="text-neutral5">Main content area</p>
        </div>
      </MainContentContent>
    </MainContentLayout>
  ),
};

export const Centered: Story = {
  render: () => (
    <MainContentLayout className="h-[400px] bg-surface1">
      <PageHeader title="Empty State" />
      <MainContentContent isCentered>
        <div className="text-center">
          <p className="text-neutral5 text-lg">No items found</p>
          <p className="text-neutral3 text-sm">Create your first item to get started</p>
        </div>
      </MainContentContent>
    </MainContentLayout>
  ),
};

export const Divided: Story = {
  render: () => (
    <MainContentLayout className="h-[400px] bg-surface1">
      <PageHeader title="Split View" />
      <MainContentContent isDivided>
        <div className="p-4 border-r border-border1">
          <p className="text-neutral5">Left column content</p>
        </div>
        <div className="p-4">
          <p className="text-neutral5">Right column content</p>
        </div>
      </MainContentContent>
    </MainContentLayout>
  ),
};

export const WithLeftServiceColumn: Story = {
  render: () => (
    <MainContentLayout className="h-[400px] bg-surface1">
      <PageHeader title="With Navigation" />
      <MainContentContent hasLeftServiceColumn>
        <div className="p-2 border-r border-border1 bg-surface2">
          <p className="text-neutral3 text-sm">Nav</p>
        </div>
        <div className="p-4">
          <p className="text-neutral5">Main content</p>
        </div>
      </MainContentContent>
    </MainContentLayout>
  ),
};

export const DividedWithServiceColumn: Story = {
  render: () => (
    <MainContentLayout className="h-[400px] bg-surface1">
      <PageHeader title="Three Column Layout" />
      <MainContentContent isDivided hasLeftServiceColumn>
        <div className="p-2 border-r border-border1 bg-surface2">
          <p className="text-neutral3 text-sm">Nav</p>
        </div>
        <div className="p-4 border-r border-border1">
          <p className="text-neutral5">Center column</p>
        </div>
        <div className="p-4">
          <p className="text-neutral5">Right column</p>
        </div>
      </MainContentContent>
    </MainContentLayout>
  ),
};
