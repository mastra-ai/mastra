import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../Button';
import { TooltipProvider } from '../Tooltip';
import { Tree, flattenTreeRows } from './tree';
import type { FlatTreeRow } from './tree';
import { IconFileText } from '@/ds/icons/central/IconFileText';
import { IconFolder1 } from '@/ds/icons/central/IconFolder1';
import { IconFolderAddRight } from '@/ds/icons/central/IconFolderAddRight';
import { IconFolderOpen } from '@/ds/icons/central/IconFolderOpen';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { IconScript } from '@/ds/icons/central/IconScript';
import { TrashIcon } from '@/ds/icons/TrashIcon';

const meta: Meta<typeof Tree> = {
  title: 'DataDisplay/Tree',
  component: Tree,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Tree>;

interface Node {
  name: string;
  meta?: string;
  children?: Node[];
  draft?: 'file' | 'folder';
}

type Row = FlatTreeRow<Node>;

const project: Node[] = [
  {
    name: 'src',
    children: [{ name: 'index.ts' }, { name: 'components', children: [{ name: 'App.tsx' }] }, { name: 'utils.ts' }],
  },
  { name: 'package.json' },
  { name: 'README.md' },
  { name: 'LICENSE' },
];

const logs = (count: number): Node => ({
  name: 'logs',
  children: Array.from({ length: count }, (_, i) => ({ name: `run-${String(i).padStart(5, '0')}.json` })),
});

function useOpenFolders(initial: string[]) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set(initial));
  const setFolderOpen = (id: string, expanded: boolean) =>
    setOpen(current => {
      const next = new Set(current);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });
  return [open, setFolderOpen] as const;
}

function toRows(nodes: Node[], open: ReadonlySet<string>): Row[] {
  return flattenTreeRows(nodes, {
    getId: node => node.name,
    getChildren: node => node.children,
    isOpen: id => open.has(id),
  });
}

function NodeIcon({ row }: { row: Row }) {
  if (row.expanded === undefined) {
    return (
      <Tree.Icon className="text-muted-foreground">
        {/\.(tsx?|jsx?)$/.test(row.node.name) ? <IconScript /> : <IconFileText />}
      </Tree.Icon>
    );
  }
  return <Tree.Icon className="text-muted-foreground">{row.expanded ? <IconFolderOpen /> : <IconFolder1 />}</Tree.Icon>;
}

function FileTree({
  nodes,
  initialOpen,
  className = 'w-75',
  contentClassName,
}: {
  nodes: Node[];
  initialOpen: string[];
  className?: string;
  contentClassName?: string;
}) {
  const [open, setFolderOpen] = useOpenFolders(initialOpen);
  const [selected, setSelected] = useState<string>();
  return (
    <div className={className}>
      <Tree
        aria-label="Files"
        contentClassName={contentClassName}
        rows={toRows(nodes, open)}
        getRowLabel={row => row.node.name}
        selectedId={selected}
        onActivate={row => (row.expanded === undefined ? setSelected(row.id) : setFolderOpen(row.id, !row.expanded))}
        onExpandedChange={(row, expanded) => setFolderOpen(row.id, expanded)}
        renderRow={row => (
          <>
            <NodeIcon row={row} />
            <Tree.Label>{row.node.name}</Tree.Label>
            {row.node.meta ? <span className="ml-auto text-meta text-muted-foreground">{row.node.meta}</span> : null}
          </>
        )}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <FileTree nodes={project} initialOpen={['src', 'components']} />,
};

export const CustomContent: Story = {
  render: () => (
    <FileTree
      nodes={[
        {
          name: 'packages',
          meta: '12 items',
          children: [
            { name: 'core', meta: 'v2.1.0' },
            { name: 'cli', meta: 'v1.0.3' },
          ],
        },
      ]}
      initialOpen={['packages']}
    />
  ),
};

function WithActionsExample() {
  const [nodes, setNodes] = useState(project);
  const [open, setFolderOpen] = useOpenFolders(['src']);
  const [draft, setDraft] = useState<'file' | 'folder'>();
  const shown = nodes.map(node =>
    node.name === 'src' && draft ? { ...node, children: [{ name: '', draft }, ...(node.children ?? [])] } : node,
  );
  const create = (name: string) => {
    setNodes(current =>
      current.map(node =>
        node.name === 'src'
          ? { ...node, children: [...(node.children ?? []), draft === 'folder' ? { name, children: [] } : { name }] }
          : node,
      ),
    );
    setDraft(undefined);
  };
  const startDraft = (type: 'file' | 'folder') => {
    setFolderOpen('src', true);
    setDraft(type);
  };

  return (
    <TooltipProvider>
      <div className="w-75">
        <Tree
          aria-label="Files"
          rows={toRows(shown, open)}
          getRowLabel={row => row.node.name}
          onActivate={row => row.expanded !== undefined && setFolderOpen(row.id, !row.expanded)}
          onExpandedChange={(row, expanded) => setFolderOpen(row.id, expanded)}
          renderRow={row =>
            row.node.draft ? (
              <Tree.Input
                type={row.node.draft}
                placeholder={row.node.draft === 'folder' ? 'Folder name' : 'File name'}
                onSubmit={create}
                onCancel={() => setDraft(undefined)}
              />
            ) : (
              <>
                <NodeIcon row={row} />
                <Tree.Label>{row.node.name}</Tree.Label>
                <span className="ml-auto flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                  {row.id === 'src' ? (
                    <>
                      <Button size="icon-sm" variant="ghost" tooltip="New file" onClick={() => startDraft('file')}>
                        <IconPlusMedium />
                      </Button>
                      <Button size="icon-sm" variant="ghost" tooltip="New folder" onClick={() => startDraft('folder')}>
                        <IconFolderAddRight />
                      </Button>
                    </>
                  ) : (
                    <Button size="icon-sm" variant="ghost" tooltip={`Delete ${row.node.name}`}>
                      <TrashIcon />
                    </Button>
                  )}
                </span>
              </>
            )
          }
        />
      </div>
    </TooltipProvider>
  );
}

export const WithActions: Story = {
  render: () => <WithActionsExample />,
};

export const TenThousandFiles: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <FileTree
      nodes={[project[0] ?? { name: 'src' }, logs(10_000), { name: 'README.md' }]}
      initialOpen={['src', 'logs']}
      className="flex h-screen w-80 flex-col border-r border-border"
      contentClassName="p-2"
    />
  ),
};
