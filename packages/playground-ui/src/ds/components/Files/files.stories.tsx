import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, FolderGit2, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Files } from './files';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

const meta: Meta<typeof Files> = {
  title: 'DataDisplay/Files',
  component: Files,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <div className="h-144 min-h-0">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Files>;

const contents: Record<string, string> = {
  'src/features/workspace/index.ts': "export const greeting = 'Hello, world';",
  'package.json': '{\n  "name": "example"\n}',
  'README.md': '---\ntitle: Example\n---\n# Example project\n\nSelect a file to preview it.',
  'archive.custom': 'Unknown file types use a neutral generic icon.',
};

function BasicFiles() {
  const [selectedPath, setSelectedPath] = useState('src/features/workspace/index.ts');

  return (
    <Files selectedPath={selectedPath} onSelect={setSelectedPath}>
      <Files.FileTree header={<span>Project files</span>}>
        <Files.Folder
          id="src"
          label="src"
          defaultOpen
          actions={
            <DropdownMenu.Item>
              <Pencil /> Rename folder
            </DropdownMenu.Item>
          }
        >
          <Files.Folder id="src/features" label="features" defaultOpen>
            <Files.Folder id="src/features/workspace" label="workspace" defaultOpen>
              <Files.File id="src/features/workspace/index.ts" label="index.ts" metadata="1 KB" />
            </Files.Folder>
          </Files.Folder>
        </Files.Folder>
        <Files.File
          id="package.json"
          label="package.json"
          metadata="2 KB"
          actions={
            <DropdownMenu.Item>
              <Trash2 /> Delete package.json
            </DropdownMenu.Item>
          }
        />
        <Files.File id="README.md" label="README.md" />
        <Files.File id="archive.custom" label="archive.custom" />
      </Files.FileTree>
      <Files.FilePreview
        path={selectedPath}
        content={contents[selectedPath] ?? ''}
        actions={
          <Button variant="ghost" size="icon-sm" tooltip="Download file">
            <Download />
          </Button>
        }
      />
    </Files>
  );
}

export const Basic: Story = { render: () => <BasicFiles /> };

function LazyFiles() {
  const [selectedPath, setSelectedPath] = useState<string>();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadFolder = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 800);
  };

  return (
    <Files selectedPath={selectedPath} onSelect={setSelectedPath}>
      <Files.FileTree title="Remote files">
        <Files.Folder
          id="repository"
          label="repository"
          icon={<FolderGit2 />}
          open={open}
          loading={loading}
          onOpenChange={setOpen}
          onLoad={loadFolder}
        >
          <Files.File id="repository/README.md" label="README.md" />
        </Files.Folder>
      </Files.FileTree>
      <Files.FilePreview path={selectedPath} content="# Remote repository" />
    </Files>
  );
}

export const LazyFolder: Story = { render: () => <LazyFiles /> };

export const States: Story = {
  render: () => (
    <div className="grid h-full grid-cols-3 gap-4 p-4">
      <Files selectedPath={undefined} onSelect={() => {}}>
        <Files.FileTree loading />
        <Files.FilePreview />
      </Files>
      <Files selectedPath={undefined} onSelect={() => {}}>
        <Files.FileTree error="Could not load files" />
        <Files.FilePreview />
      </Files>
      <Files selectedPath={undefined} onSelect={() => {}}>
        <Files.FileTree empty="No files yet" />
        <Files.FilePreview />
      </Files>
    </div>
  ),
};

export const CustomPreview: Story = {
  render: () => (
    <Files selectedPath="skills/reviewer.md" onSelect={() => {}}>
      <Files.FileTree>
        <Files.Folder id="skills" label="skills" defaultOpen>
          <Files.File id="skills/reviewer.md" label="reviewer.md" />
        </Files.Folder>
      </Files.FileTree>
      <Files.FilePreview path="skills/reviewer.md">
        <div className="m-auto max-w-lg rounded-lg border border-border1 bg-surface3 p-6">
          <h2 className="text-lg font-semibold text-neutral6">Code reviewer</h2>
          <p className="mt-2 text-sm text-neutral4">A domain-specific preview supplied by the consumer.</p>
        </div>
      </Files.FilePreview>
    </Files>
  ),
};

export const ImagePreview: Story = {
  render: () => (
    <Files selectedPath="pixel.svg" onSelect={() => {}}>
      <Files.FileTree>
        <Files.File id="pixel.svg" label="pixel.svg" />
      </Files.FileTree>
      <Files.FilePreview
        path="pixel.svg"
        mimeType="image/svg+xml"
        content="PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgcng9IjIwIiBmaWxsPSIjN0M2M0ZGIi8+PC9zdmc+"
      />
    </Files>
  ),
};
