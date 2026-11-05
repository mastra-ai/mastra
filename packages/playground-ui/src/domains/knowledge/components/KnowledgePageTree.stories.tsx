import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { KnowledgePagePayload } from '../pageTypes';
import { KnowledgePageTree } from './KnowledgePageTree';

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: parentId === null ? id : 'lin',
    parentId,
    isScope: parentId === null,
    position: 'a0',
    name: id,
    version: 1,
    createdBy: { author: 'host' },
    updatedBy: { author: 'host' },
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...extra,
  };
}

const ADDRESS = 'linear:lin_01M6M0HHKH3T8VAWTWZ13MKNCE';
const pages = [
  page('lin', null, { name: ADDRESS, address: ADDRESS, childCount: 1 }),
  page('org', null, { name: 'Acme', address: 'org:acme', position: 'a1', childCount: 2 }),
  page('workspace', 'lin', { name: 'linear', childCount: 2 }),
  page('projects', 'workspace', { name: 'project', childCount: 30 }),
  page('documents', 'workspace', { name: 'document', position: 'a1', childCount: 68 }),
  page('launch', 'documents', { name: 'Launch plan' }),
  page('gateway', 'documents', {
    name: 'Gateway BYOK connections and project routing for every environment and region',
    position: 'a1',
  }),
  page('policies', 'org', { name: 'Policies' }),
  page('refunds', 'org', { name: 'Refund policy', position: 'a1' }),
];

function Tree({ initiallySelected }: { initiallySelected?: string }) {
  const [selected, setSelected] = useState<string | null>(initiallySelected ?? null);
  return (
    <div className="h-120 w-72 overflow-auto rounded-xl border border-border bg-card p-1">
      <KnowledgePageTree
        pages={pages}
        pinnedIds={['refunds']}
        selectedPageId={selected}
        onSelect={entry => setSelected(entry.id)}
      />
    </div>
  );
}

const meta: Meta<typeof Tree> = {
  title: 'Domains/Knowledge/PageTree',
  component: Tree,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Tree>;

export const Default: Story = {};

export const DeepSelection: Story = { args: { initiallySelected: 'gateway' } };
