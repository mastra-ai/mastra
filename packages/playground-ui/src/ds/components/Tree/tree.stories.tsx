import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FileCode, FileJson, FolderGit2, FolderOpen, FolderPlus, Plus, Settings, Trash2 } from 'lucide-react';
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
        <Tree.Folder name="src">
          <Tree.File name="index.ts" id="src/index.ts" />
          <Tree.File name="utils.ts" id="src/utils.ts" />
        </Tree.Folder>
        <Tree.File name="package.json" id="package.json" />
        <Tree.File name="tsconfig.json" id="tsconfig.json" />
      </Tree>
    </div>
  ),
};

export const DefaultOpen: Story = {
  render: () => (
    <div className="w-[300px]">
      <Tree>
        <Tree.Folder name="src" defaultOpen>
          <Tree.File name="index.ts" id="src/index.ts" />
          <Tree.Folder name="components" defaultOpen>
            <Tree.File name="App.tsx" id="src/components/App.tsx" />
            <Tree.File name="Header.tsx" id="src/components/Header.tsx" />
          </Tree.Folder>
          <Tree.File name="utils.ts" id="src/utils.ts" />
        </Tree.Folder>
        <Tree.File name="package.json" id="package.json" />
      </Tree>
    </div>
  ),
};

function WithSelectionExample() {
  const [selected, setSelected] = useState('src/index.ts');

  return (
    <div className="w-[300px]">
      <Tree selectedId={selected} onSelect={setSelected}>
        <Tree.Folder name="src" defaultOpen>
          <Tree.File name="index.ts" id="src/index.ts" />
          <Tree.File name="utils.ts" id="src/utils.ts" />
          <Tree.Folder name="components" defaultOpen>
            <Tree.File name="App.tsx" id="src/components/App.tsx" />
            <Tree.File name="Header.tsx" id="src/components/Header.tsx" />
          </Tree.Folder>
        </Tree.Folder>
        <Tree.File name="package.json" id="package.json" />
        <Tree.File name="README.md" id="README.md" />
      </Tree>
    </div>
  );
}

export const WithSelection: Story = {
  render: () => <WithSelectionExample />,
};

export const DeeplyNested: Story = {
  render: () => (
    <div className="w-[300px]">
      <Tree>
        <Tree.Folder name="packages" defaultOpen>
          <Tree.Folder name="core" defaultOpen>
            <Tree.Folder name="src" defaultOpen>
              <Tree.Folder name="agent" defaultOpen>
                <Tree.File name="index.ts" id="packages/core/src/agent/index.ts" />
                <Tree.File name="types.ts" id="packages/core/src/agent/types.ts" />
              </Tree.Folder>
              <Tree.Folder name="tools">
                <Tree.File name="index.ts" id="packages/core/src/tools/index.ts" />
              </Tree.Folder>
            </Tree.Folder>
            <Tree.File name="package.json" id="packages/core/package.json" />
          </Tree.Folder>
        </Tree.Folder>
      </Tree>
    </div>
  ),
};

export const CustomIcons: Story = {
  render: () => (
    <div className="w-[300px]">
      <Tree>
        <Tree.Folder name="src" icon={<FolderOpen />} defaultOpen>
          <Tree.File name="index.ts" icon={<FileCode />} id="src/index.ts" />
          <Tree.File name="config.json" icon={<FileJson />} id="src/config.json" />
          <Tree.File name="settings.ts" icon={<Settings />} id="src/settings.ts" />
        </Tree.Folder>
      </Tree>
    </div>
  ),
};

export const FileTypeIcons: Story = {
  render: () => (
    <div className="w-[300px]">
      <Tree>
        <Tree.Folder name="project" defaultOpen>
          <Tree.File name="index.ts" id="index.ts" />
          <Tree.File name="App.tsx" id="App.tsx" />
          <Tree.File name="helpers.js" id="helpers.js" />
          <Tree.File name="Button.jsx" id="Button.jsx" />
          <Tree.File name="package.json" id="package.json" />
          <Tree.File name="tsconfig.json" id="tsconfig.json" />
          <Tree.File name="README.md" id="README.md" />
          <Tree.File name="CHANGELOG.mdx" id="CHANGELOG.mdx" />
          <Tree.File name="LICENSE" id="LICENSE" />
          <Tree.File name=".gitignore" id=".gitignore" />
        </Tree.Folder>
      </Tree>
    </div>
  ),
};

export const WithActions: Story = {
  render: () => (
    <TooltipProvider>
      <div className="w-[300px]">
        <Tree>
          <Tree.Folder
            name="src"
            defaultOpen
            action={
              <IconButton size="sm" variant="ghost" tooltip="Add folder" onClick={e => e.stopPropagation()}>
                <FolderPlus />
              </IconButton>
            }
          >
            <Tree.File
              name="index.ts"
              id="src/index.ts"
              action={
                <IconButton size="sm" variant="ghost" tooltip="Delete file" onClick={e => e.stopPropagation()}>
                  <Trash2 />
                </IconButton>
              }
            />
            <Tree.File
              name="utils.ts"
              id="src/utils.ts"
              action={
                <IconButton size="sm" variant="ghost" tooltip="Delete file" onClick={e => e.stopPropagation()}>
                  <Trash2 />
                </IconButton>
              }
            />
            <Tree.Folder
              name="components"
              action={
                <IconButton size="sm" variant="ghost" tooltip="Add file" onClick={e => e.stopPropagation()}>
                  <Plus />
                </IconButton>
              }
            >
              <Tree.File name="App.tsx" id="src/components/App.tsx" />
            </Tree.Folder>
          </Tree.Folder>
        </Tree>
      </div>
    </TooltipProvider>
  ),
};

export const Composable: Story = {
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
