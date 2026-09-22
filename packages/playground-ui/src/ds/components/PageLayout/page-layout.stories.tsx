import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlusIcon, CircleSlashIcon } from 'lucide-react';

import { ActionRow } from '../ActionRow';
import { Breadcrumb, Crumb } from '../Breadcrumb';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { Input } from '../Input';
import { PageLayout } from './index';

const meta: Meta<typeof PageLayout> = {
  title: 'Layout/PageLayout',
  component: PageLayout,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof PageLayout>;

const resources = ['Research agent', 'Support workflow', 'Knowledge search tool'];

const crumbs = (
  <Breadcrumb>
    <Crumb as="span" isCurrent>
      Resources
    </Crumb>
  </Breadcrumb>
);

export const FullPage: Story = {
  render: () => (
    <div className="h-152 bg-sidebar">
      <PageLayout
        breadcrumbs={crumbs}
        headerActions={
          <Button variant="primary">
            <PlusIcon />
            Create resource
          </Button>
        }
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
        <ul className="grid gap-2">
          {resources.map(resource => (
            <li key={resource} className="rounded border border-border px-3 py-2">
              {resource}
            </li>
          ))}
        </ul>
      </PageLayout>
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="h-152 bg-sidebar">
      <PageLayout breadcrumbs={crumbs}>
        <div className="flex h-full items-center justify-center">
          <EmptyState
            iconSlot={<CircleSlashIcon />}
            titleSlot="No resources yet"
            descriptionSlot="Create a resource to get started."
          />
        </div>
      </PageLayout>
    </div>
  ),
};
