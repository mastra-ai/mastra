import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, useCallback } from 'react';
import { File, FileCode, FileJson, FileText, Folder, FolderGit2, FolderPlus, Plus, Trash2 } from 'lucide-react';
import { Tree } from './tree';
import { IconButton } from '../IconButton';
import { TooltipProvider } from '../Tooltip';

const meta: Meta<typeof Tree> = {
  title: 'DataDisplay/Tree',
  component: Tree,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tree>;

export const Default: Story = {
  render: () => (
    <div className="w-[300px]">
      <Tree>
        <Tree.Folder defaultOpen>
          <Tree.FolderTrigger>
            <Tree.Icon className="text-accent6">
              <Folder />
            </Tree.Icon>
            <Tree.Label>src</Tree.Label>
          </Tree.FolderTrigger>
          <Tree.FolderContent>
            <Tree.File id="src/index.ts">
              <Tree.Icon className="text-accent3">
                <FileCode />
              </Tree.Icon>
              <Tree.Label>index.ts</Tree.Label>
            </Tree.File>
            <Tree.Folder defaultOpen>
              <Tree.FolderTrigger>
                <Tree.Icon className="text-accent6">
                  <Folder />
                </Tree.Icon>
                <Tree.Label>components</Tree.Label>
              </Tree.FolderTrigger>
              <Tree.FolderContent>
                <Tree.File id="src/components/App.tsx">
                  <Tree.Icon className="text-accent3">
                    <FileCode />
                  </Tree.Icon>
                  <Tree.Label>App.tsx</Tree.Label>
                </Tree.File>
              </Tree.FolderContent>
            </Tree.Folder>
            <Tree.File id="src/utils.ts">
              <Tree.Icon className="text-accent3">
                <FileCode />
              </Tree.Icon>
              <Tree.Label>utils.ts</Tree.Label>
            </Tree.File>
          </Tree.FolderContent>
        </Tree.Folder>
        <Tree.File id="package.json">
          <Tree.Icon className="text-accent6">
            <FileJson />
          </Tree.Icon>
          <Tree.Label>package.json</Tree.Label>
        </Tree.File>
        <Tree.File id="README.md">
          <Tree.Icon className="text-accent5">
            <FileText />
          </Tree.Icon>
          <Tree.Label>README.md</Tree.Label>
        </Tree.File>
        <Tree.File id="LICENSE">
          <Tree.Icon className="text-neutral3">
            <File />
          </Tree.Icon>
          <Tree.Label>LICENSE</Tree.Label>
        </Tree.File>
      </Tree>
    </div>
  ),
};

function WithSelectionExample() {
  const [selected, setSelected] = useState('src/index.ts');

  return (
    <div className="w-[300px]">
      <Tree selectedId={selected} onSelect={setSelected}>
        <Tree.Folder defaultOpen>
          <Tree.FolderTrigger>
            <Tree.Icon className="text-accent6">
              <Folder />
            </Tree.Icon>
            <Tree.Label>src</Tree.Label>
          </Tree.FolderTrigger>
          <Tree.FolderContent>
            <Tree.File id="src/index.ts">
              <Tree.Icon className="text-accent3">
                <FileCode />
              </Tree.Icon>
              <Tree.Label>index.ts</Tree.Label>
            </Tree.File>
            <Tree.File id="src/utils.ts">
              <Tree.Icon className="text-accent3">
                <FileCode />
              </Tree.Icon>
              <Tree.Label>utils.ts</Tree.Label>
            </Tree.File>
          </Tree.FolderContent>
        </Tree.Folder>
        <Tree.File id="package.json">
          <Tree.Icon className="text-accent6">
            <FileJson />
          </Tree.Icon>
          <Tree.Label>package.json</Tree.Label>
        </Tree.File>
      </Tree>
    </div>
  );
}

export const WithSelection: Story = {
  render: () => <WithSelectionExample />,
};

export const WithActions: Story = {
  render: () => (
    <TooltipProvider>
      <div className="w-[300px]">
        <Tree>
          <Tree.Folder defaultOpen>
            <Tree.FolderTrigger
              actions={
                <span className="opacity-0 group-hover:opacity-100">
                  <IconButton size="sm" variant="ghost" tooltip="Add folder">
                    <FolderPlus />
                  </IconButton>
                </span>
              }
            >
              <Tree.Icon className="text-accent6">
                <Folder />
              </Tree.Icon>
              <Tree.Label>src</Tree.Label>
            </Tree.FolderTrigger>
            <Tree.FolderContent>
              <Tree.File id="src/index.ts">
                <Tree.Icon className="text-accent3">
                  <FileCode />
                </Tree.Icon>
                <Tree.Label>index.ts</Tree.Label>
                <span className="ml-auto shrink-0 opacity-0 group-hover:opacity-100">
                  <IconButton size="sm" variant="ghost" tooltip="Delete file" onClick={e => e.stopPropagation()}>
                    <Trash2 />
                  </IconButton>
                </span>
              </Tree.File>
              <Tree.Folder>
                <Tree.FolderTrigger
                  actions={
                    <span className="opacity-0 group-hover:opacity-100">
                      <IconButton size="sm" variant="ghost" tooltip="Add file">
                        <Plus />
                      </IconButton>
                    </span>
                  }
                >
                  <Tree.Icon className="text-accent6">
                    <Folder />
                  </Tree.Icon>
                  <Tree.Label>components</Tree.Label>
                </Tree.FolderTrigger>
                <Tree.FolderContent>
                  <Tree.File id="src/components/App.tsx">
                    <Tree.Icon className="text-accent3">
                      <FileCode />
                    </Tree.Icon>
                    <Tree.Label>App.tsx</Tree.Label>
                  </Tree.File>
                </Tree.FolderContent>
              </Tree.Folder>
            </Tree.FolderContent>
          </Tree.Folder>
        </Tree>
      </div>
    </TooltipProvider>
  ),
};

export const CustomContent: Story = {
  render: () => (
    <div className="w-[300px]">
      <Tree>
        <Tree.Folder defaultOpen>
          <Tree.FolderTrigger>
            <Tree.Icon>
              <FolderGit2 className="text-accent6" />
            </Tree.Icon>
            <Tree.Label>packages</Tree.Label>
            <span className="ml-auto text-[10px] text-neutral3">12 items</span>
          </Tree.FolderTrigger>
          <Tree.FolderContent>
            <Tree.File>
              <Tree.Icon>
                <FileCode className="text-neutral3" />
              </Tree.Icon>
              <Tree.Label>core</Tree.Label>
              <span className="ml-auto text-[10px] text-neutral3">v2.1.0</span>
            </Tree.File>
            <Tree.File>
              <Tree.Icon>
                <FileCode className="text-neutral3" />
              </Tree.Icon>
              <Tree.Label>cli</Tree.Label>
              <span className="ml-auto text-[10px] text-neutral3">v1.0.3</span>
            </Tree.File>
          </Tree.FolderContent>
        </Tree.Folder>
      </Tree>
    </div>
  ),
};

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
}

function WithInlineCreationExample() {
  const [files, setFiles] = useState<FileItem[]>([
    { id: 'src/index.ts', name: 'index.ts', type: 'file' },
    { id: 'src/utils.ts', name: 'utils.ts', type: 'file' },
  ]);
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null);

  const handleSubmit = useCallback(
    (name: string) => {
      const type = creating ?? 'file';
      setFiles(prev => [...prev, { id: `src/${name}`, name, type }]);
      setCreating(null);
    },
    [creating],
  );

  const handleCancel = useCallback(() => {
    setCreating(null);
  }, []);

  return (
    <TooltipProvider>
      <div className="w-[300px]">
        <Tree>
          <Tree.Folder defaultOpen>
            <Tree.FolderTrigger
              actions={
                <span className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                  <IconButton size="sm" variant="ghost" tooltip="New file" onClick={() => setCreating('file')}>
                    <Plus />
                  </IconButton>
                  <IconButton size="sm" variant="ghost" tooltip="New folder" onClick={() => setCreating('folder')}>
                    <FolderPlus />
                  </IconButton>
                </span>
              }
            >
              <Tree.Icon className="text-accent6">
                <Folder />
              </Tree.Icon>
              <Tree.Label>src</Tree.Label>
            </Tree.FolderTrigger>
            <Tree.FolderContent>
              {creating && (
                <Tree.Input
                  type={creating}
                  placeholder={creating === 'folder' ? 'Folder name…' : 'File name…'}
                  onSubmit={handleSubmit}
                  onCancel={handleCancel}
                />
              )}
              {files.map(file =>
                file.type === 'folder' ? (
                  <Tree.Folder key={file.id}>
                    <Tree.FolderTrigger>
                      <Tree.Icon className="text-accent6">
                        <Folder />
                      </Tree.Icon>
                      <Tree.Label>{file.name}</Tree.Label>
                    </Tree.FolderTrigger>
                    <Tree.FolderContent>{null}</Tree.FolderContent>
                  </Tree.Folder>
                ) : (
                  <Tree.File key={file.id} id={file.id}>
                    <Tree.Icon className="text-accent3">
                      <FileCode />
                    </Tree.Icon>
                    <Tree.Label>{file.name}</Tree.Label>
                  </Tree.File>
                ),
              )}
            </Tree.FolderContent>
          </Tree.Folder>
        </Tree>
      </div>
    </TooltipProvider>
  );
}

export const WithInlineCreation: Story = {
  render: () => <WithInlineCreationExample />,
};
