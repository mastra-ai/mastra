import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TreeIcon } from '../Tree/tree-icon';
import { TreeLabel } from '../Tree/tree-label';
import { VirtualTree } from './virtual-tree';
import type { VirtualTreeRow } from './virtual-tree';
import { FileIcon, FolderIcon } from '@/ds/icons';

const meta: Meta<typeof VirtualTree> = {
  title: 'DataDisplay/VirtualTree',
  component: VirtualTree,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof VirtualTree>;

interface Node {
  name: string;
  children?: Node[];
}

const folder = (name: string, count: number): Node => ({
  name,
  children: Array.from({ length: count }, (_, i) => ({ name: `${name}-${String(i).padStart(5, '0')}.json` })),
});

const tree: Node[] = [
  { name: 'src', children: [{ name: 'index.ts' }, { name: 'agents', children: [{ name: 'support.ts' }] }] },
  folder('logs', 10_000),
  { name: 'README.md' },
];

type Row = VirtualTreeRow & { node: Node };

function flatten(nodes: Node[], parent: string, level: number, open: ReadonlySet<string>, rows: Row[]) {
  nodes.forEach((node, index) => {
    const id = parent ? `${parent}/${node.name}` : node.name;
    const expanded = node.children ? open.has(id) : undefined;
    rows.push({ id, node, level, posInSet: index + 1, setSize: nodes.length, expanded });
    if (expanded && node.children) flatten(node.children, id, level + 1, open, rows);
  });
  return rows;
}

function Files() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set(['src', 'logs']));
  const [selected, setSelected] = useState<string>();
  const toggle = (id: string, expanded: boolean) =>
    setOpen(current => {
      const next = new Set(current);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="flex h-screen w-80 flex-col border-r border-border">
      <VirtualTree
        aria-label="Files"
        rows={flatten(tree, '', 0, open, [])}
        selectedId={selected}
        onActivate={row => (row.expanded === undefined ? setSelected(row.id) : toggle(row.id, !row.expanded))}
        onExpandedChange={(row, expanded) => toggle(row.id, expanded)}
        renderRow={row => (
          <>
            <TreeIcon>{row.expanded === undefined ? <FileIcon /> : <FolderIcon />}</TreeIcon>
            <TreeLabel>{row.node.name}</TreeLabel>
          </>
        )}
      />
    </div>
  );
}

export const TenThousandFiles: Story = { render: () => <Files /> };
