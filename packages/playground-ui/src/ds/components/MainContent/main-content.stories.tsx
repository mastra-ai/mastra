import type { Meta, StoryObj } from '@storybook/react-vite';
import { PageHeader } from '../PageHeader';
import { MainContentLayout, MainContentContent } from './main-content';

const meta: Meta<typeof MainContentLayout> = {
  title: 'Layout/MainContent',
  component: MainContentLayout,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof MainContentLayout>;

export const Default: Story = {
  render: () => (
    <MainContentLayout className="bg-surface1 h-100">
      <PageHeader>
        <PageHeader.Title>Page Title</PageHeader.Title>
        <PageHeader.Description>This is the page description</PageHeader.Description>
      </PageHeader>
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
    <MainContentLayout className="bg-surface1 h-100">
      <PageHeader>
        <PageHeader.Title>Empty State</PageHeader.Title>
      </PageHeader>
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
    <MainContentLayout className="bg-surface1 h-100">
      <PageHeader>
        <PageHeader.Title>Split View</PageHeader.Title>
      </PageHeader>
      <MainContentContent isDivided>
        <div className="border-border1 border-r p-4">
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
    <MainContentLayout className="bg-surface1 h-100">
      <PageHeader>
        <PageHeader.Title>With Navigation</PageHeader.Title>
      </PageHeader>
      <MainContentContent hasLeftServiceColumn>
        <div className="border-border1 bg-surface2 border-r p-2">
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
    <MainContentLayout className="bg-surface1 h-100">
      <PageHeader>
        <PageHeader.Title>Three Column Layout</PageHeader.Title>
      </PageHeader>
      <MainContentContent isDivided hasLeftServiceColumn>
        <div className="border-border1 bg-surface2 border-r p-2">
          <p className="text-neutral3 text-sm">Nav</p>
        </div>
        <div className="border-border1 border-r p-4">
          <p className="text-neutral5">Center column</p>
        </div>
        <div className="p-4">
          <p className="text-neutral5">Right column</p>
        </div>
      </MainContentContent>
    </MainContentLayout>
  ),
};
