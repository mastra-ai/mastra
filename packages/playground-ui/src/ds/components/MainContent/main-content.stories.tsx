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
    <MainContentLayout className="bg-surface-primary h-100">
      <PageHeader>
        <PageHeader.Title>Page Title</PageHeader.Title>
        <PageHeader.Description>This is the page description</PageHeader.Description>
      </PageHeader>
      <MainContentContent>
        <div className="p-4">
          <p className="text-(--text-primary)">Main content area</p>
        </div>
      </MainContentContent>
    </MainContentLayout>
  ),
};

export const Centered: Story = {
  render: () => (
    <MainContentLayout className="bg-surface-primary h-100">
      <PageHeader>
        <PageHeader.Title>Empty State</PageHeader.Title>
      </PageHeader>
      <MainContentContent isCentered>
        <div className="text-center">
          <p className="text-lg text-(--text-primary)">No items found</p>
          <p className="text-sm text-(--text-secondary)">Create your first item to get started</p>
        </div>
      </MainContentContent>
    </MainContentLayout>
  ),
};

export const Divided: Story = {
  render: () => (
    <MainContentLayout className="bg-surface-primary h-100">
      <PageHeader>
        <PageHeader.Title>Split View</PageHeader.Title>
      </PageHeader>
      <MainContentContent isDivided>
        <div className="border-r border-(--border-subtle) p-4">
          <p className="text-(--text-primary)">Left column content</p>
        </div>
        <div className="p-4">
          <p className="text-(--text-primary)">Right column content</p>
        </div>
      </MainContentContent>
    </MainContentLayout>
  ),
};

export const WithLeftServiceColumn: Story = {
  render: () => (
    <MainContentLayout className="bg-surface-primary h-100">
      <PageHeader>
        <PageHeader.Title>With Navigation</PageHeader.Title>
      </PageHeader>
      <MainContentContent hasLeftServiceColumn>
        <div className="bg-surface-secondary border-r border-(--border-subtle) p-2">
          <p className="text-sm text-(--text-secondary)">Nav</p>
        </div>
        <div className="p-4">
          <p className="text-(--text-primary)">Main content</p>
        </div>
      </MainContentContent>
    </MainContentLayout>
  ),
};

export const DividedWithServiceColumn: Story = {
  render: () => (
    <MainContentLayout className="bg-surface-primary h-100">
      <PageHeader>
        <PageHeader.Title>Three Column Layout</PageHeader.Title>
      </PageHeader>
      <MainContentContent isDivided hasLeftServiceColumn>
        <div className="bg-surface-secondary border-r border-(--border-subtle) p-2">
          <p className="text-sm text-(--text-secondary)">Nav</p>
        </div>
        <div className="border-r border-(--border-subtle) p-4">
          <p className="text-(--text-primary)">Center column</p>
        </div>
        <div className="p-4">
          <p className="text-(--text-primary)">Right column</p>
        </div>
      </MainContentContent>
    </MainContentLayout>
  ),
};
