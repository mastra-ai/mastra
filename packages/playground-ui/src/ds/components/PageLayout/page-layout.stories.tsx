import type { Meta, StoryObj } from '@storybook/react-vite';
import { BoxesIcon, PlusIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { ActionRow } from '../ActionRow';
import { Breadcrumb, Crumb } from '../Breadcrumb';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { Input } from '../Input';
import { PageLayout } from './index';
import { MainCard } from '@/ds/new/layout/app-shell';
import { PageHeader } from '@/ds/new/layout/page-header';

const meta: Meta<typeof PageLayout> = {
  title: 'Layout/PageLayout',
  component: PageLayout,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof PageLayout>;

function StoryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-152 bg-sidebar p-2">
      <MainCard>{children}</MainCard>
    </div>
  );
}

const resources = ['Research agent', 'Support workflow', 'Knowledge search tool'];

const crumbs = (
  <Breadcrumb>
    <Crumb as="span">Workspace</Crumb>
    <Crumb as="span" isCurrent>
      Resources
    </Crumb>
  </Breadcrumb>
);

const headerActions = <Button variant="outline">Docs</Button>;

const pageHeader = (
  <PageHeader>
    <PageHeader.Icon>
      <BoxesIcon strokeWidth={2.5} />
    </PageHeader.Icon>
    <PageHeader.Title>Resources</PageHeader.Title>
    <PageHeader.Description>Agents, workflows and tools available in this workspace.</PageHeader.Description>
    <PageHeader.Action>
      <Button variant="primary">
        <PlusIcon />
        Create resource
      </Button>
    </PageHeader.Action>
  </PageHeader>
);

const resourceList = (
  <ul className="grid gap-2">
    {resources.map(resource => (
      <li key={resource} className="rounded border border-border px-3 py-2">
        {resource}
      </li>
    ))}
  </ul>
);

export const Container: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout breadcrumbs={crumbs} headerActions={headerActions} header={pageHeader}>
        <div className="mt-6">{resourceList}</div>
      </PageLayout>
    </StoryFrame>
  ),
};

export const Narrow: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout variant="narrow" breadcrumbs={crumbs} headerActions={headerActions} header={pageHeader}>
        <div className="mt-6">{resourceList}</div>
      </PageLayout>
    </StoryFrame>
  ),
};

export const Fit: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout variant="fit" breadcrumbs={crumbs} headerActions={headerActions} header={pageHeader}>
        <div className="mt-6 flex items-center justify-center border border-border text-placeholder">
          Full-height panel (graph, table…)
        </div>
      </PageLayout>
    </StoryFrame>
  ),
};

export const FullPage: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout
        breadcrumbs={crumbs}
        headerActions={headerActions}
        actionRow={
          <ActionRow>
            <ActionRow.Start>
              <Input placeholder="Filter resources" className="max-w-120" />
            </ActionRow.Start>
            <ActionRow.End>
              <Button variant="outline">Sort</Button>
            </ActionRow.End>
          </ActionRow>
        }
      >
        {resourceList}
      </PageLayout>
    </StoryFrame>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoryFrame>
      <PageLayout breadcrumbs={crumbs}>
        <div className="flex h-full items-center justify-center">
          <EmptyState titleSlot="No resources yet" descriptionSlot="Create a resource to get started." />
        </div>
      </PageLayout>
    </StoryFrame>
  ),
};
