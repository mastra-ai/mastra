import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlusIcon, WrenchIcon } from 'lucide-react';

import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { PageHeader } from '../PageHeader';
import { NoDataPageLayout, PageHeadingContext, PageLayout } from './index';

const meta: Meta<typeof PageLayout> = {
  title: 'Layout/PageLayout',
  component: PageLayout,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof PageLayout>;

const resources = ['Research agent', 'Support workflow', 'Knowledge search tool'];

export const FullPage: Story = {
  render: () => (
    <PageHeadingContext value="Resources">
      <div className="bg-surface-primary h-152">
        <PageLayout width="wide" height="full">
          <PageLayout.TopArea>
            <PageLayout.Row align="center" stack="responsive">
              <PageLayout.Column>
                <PageHeader>
                  <PageHeader.Title>Resources</PageHeader.Title>
                  <PageHeader.Description>
                    Agents, workflows, and tools available in this workspace.
                  </PageHeader.Description>
                </PageHeader>
              </PageLayout.Column>
              <Button variant="primary">
                <PlusIcon />
                Create resource
              </Button>
            </PageLayout.Row>
          </PageLayout.TopArea>
          <PageLayout.MainArea>
            <div className="grid gap-3 md:grid-cols-3">
              {resources.map(resource => (
                <div
                  key={resource}
                  className="bg-surface-secondary text-ui-md rounded-xl border border-(--border-subtle) p-5 text-(--text-primary)"
                >
                  {resource}
                </div>
              ))}
            </div>
          </PageLayout.MainArea>
        </PageLayout>
      </div>
    </PageHeadingContext>
  ),
};

export const NarrowSettings: Story = {
  render: () => (
    <div className="bg-surface-primary min-h-136">
      <PageLayout width="narrow">
        <PageLayout.TopArea>
          <PageHeader>
            <PageHeader.Title>Settings</PageHeader.Title>
            <PageHeader.Description>Defaults shared by every project in this workspace.</PageHeader.Description>
          </PageHeader>
        </PageLayout.TopArea>
        <PageLayout.MainArea className="grid gap-3">
          <div className="bg-surface-secondary rounded-xl border border-(--border-subtle) p-5 text-(--text-primary)">
            General settings
          </div>
          <div className="bg-surface-secondary rounded-xl border border-(--border-subtle) p-5 text-(--text-primary)">
            Environment variables
          </div>
        </PageLayout.MainArea>
      </PageLayout>
    </div>
  ),
};

export const CenteredEmptyState: Story = {
  render: () => (
    <div className="bg-surface-primary h-136">
      <NoDataPageLayout>
        <EmptyState
          iconSlot={<WrenchIcon />}
          titleSlot="No tools yet"
          descriptionSlot="Add a tool to let agents act on external systems."
        />
      </NoDataPageLayout>
    </div>
  ),
};
