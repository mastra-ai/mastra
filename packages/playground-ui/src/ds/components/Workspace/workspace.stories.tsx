import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { File, FileCode, FileJson, FileText, Folder, FolderOpen, Image } from 'lucide-react';
import { Tree } from '../Tree';
import { TooltipProvider } from '../Tooltip';

/**
 * The Workspace compound component provides a file tree browser and file preview panel.
 *
 * Usage with API hooks:
 * ```tsx
 * <Workspace workspaceId="my-workspace">
 *   <Workspace.Tree allowCreate className="w-64 border-r border-border1" />
 *   <Workspace.File className="flex-1" />
 * </Workspace>
 * ```
 *
 * These stories demonstrate the visual structure using the underlying Tree component,
 * since the full Workspace requires MastraClient and QueryClient providers.
 */

const meta: Meta = {
  title: 'DataDisplay/Workspace',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

function getFileIcon(name: string, type: 'file' | 'directory', isOpen = false) {
  if (type === 'directory') {
    return isOpen ? <FolderOpen className="text-amber-400" /> : <Folder className="text-amber-400" />;
  }
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="text-blue-400" />;
    case 'json':
      return <FileJson className="text-yellow-400" />;
    case 'md':
    case 'mdx':
      return <FileText className="text-neutral4" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="text-purple-400" />;
    default:
      return <File className="text-neutral4" />;
  }
}

function WorkspaceVisualExample() {
  const [selectedPath, setSelectedPath] = useState<string | null>('/src/index.ts');

  const fileContents: Record<string, string> = {
    '/src/index.ts': 'export { Mastra } from "./mastra";\nexport type { MastraConfig } from "./types";',
    '/src/utils.ts': 'export function formatDate(date: Date): string {\n  return date.toISOString();\n}',
    '/package.json': '{\n  "name": "my-project",\n  "version": "1.0.0"\n}',
    '/README.md': '# My Project\n\nA sample workspace project.',
  };

  const selectedFileName = selectedPath?.split('/').pop() || '';
  const selectedContent = selectedPath ? fileContents[selectedPath] || '' : '';

  return (
    <TooltipProvider>
      <div className="flex w-[600px] rounded-lg border border-border1 overflow-hidden" style={{ height: 400 }}>
        {/* Tree panel */}
        <div className="w-52 shrink-0 border-r border-border1 overflow-auto py-1">
          <Tree selectedId={selectedPath ?? undefined} onSelect={setSelectedPath}>
            <Tree.Folder defaultOpen>
              <Tree.FolderTrigger>
                <Tree.Icon>{getFileIcon('src', 'directory')}</Tree.Icon>
                <Tree.Label>src</Tree.Label>
              </Tree.FolderTrigger>
              <Tree.FolderContent>
                <Tree.File id="/src/index.ts">
                  <Tree.Icon>{getFileIcon('index.ts', 'file')}</Tree.Icon>
                  <Tree.Label>index.ts</Tree.Label>
                </Tree.File>
                <Tree.File id="/src/utils.ts">
                  <Tree.Icon>{getFileIcon('utils.ts', 'file')}</Tree.Icon>
                  <Tree.Label>utils.ts</Tree.Label>
                </Tree.File>
                <Tree.Folder>
                  <Tree.FolderTrigger>
                    <Tree.Icon>{getFileIcon('components', 'directory')}</Tree.Icon>
                    <Tree.Label>components</Tree.Label>
                  </Tree.FolderTrigger>
                  <Tree.FolderContent>
                    <Tree.File id="/src/components/App.tsx">
                      <Tree.Icon>{getFileIcon('App.tsx', 'file')}</Tree.Icon>
                      <Tree.Label>App.tsx</Tree.Label>
                    </Tree.File>
                  </Tree.FolderContent>
                </Tree.Folder>
              </Tree.FolderContent>
            </Tree.Folder>
            <Tree.File id="/package.json">
              <Tree.Icon>{getFileIcon('package.json', 'file')}</Tree.Icon>
              <Tree.Label>package.json</Tree.Label>
            </Tree.File>
            <Tree.File id="/README.md">
              <Tree.Icon>{getFileIcon('README.md', 'file')}</Tree.Icon>
              <Tree.Label>README.md</Tree.Label>
            </Tree.File>
          </Tree>
        </div>

        {/* File preview panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedPath ? (
            <>
              <div className="border-b border-border1 px-3 py-1.5">
                <span className="text-xs text-neutral5">{selectedFileName}</span>
              </div>
              <div className="flex-1 overflow-auto">
                <pre className="p-4 font-mono text-xs text-neutral5 whitespace-pre-wrap">{selectedContent}</pre>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-neutral3">
              Select a file to preview
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export const Default: Story = {
  render: () => <WorkspaceVisualExample />,
};

function EmptyWorkspaceExample() {
  return (
    <div className="flex w-[600px] rounded-lg border border-border1 overflow-hidden" style={{ height: 300 }}>
      <div className="w-52 shrink-0 border-r border-border1 flex items-center justify-center">
        <span className="text-xs text-neutral3">No files</span>
      </div>
      <div className="flex flex-1 items-center justify-center text-xs text-neutral3">Select a file to preview</div>
    </div>
  );
}

export const Empty: Story = {
  render: () => <EmptyWorkspaceExample />,
};
