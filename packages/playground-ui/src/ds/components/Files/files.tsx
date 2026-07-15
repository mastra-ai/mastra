/* eslint-disable react-refresh/only-export-components -- compound component implementation intentionally co-locates its public parts */
import {
  ChevronRight,
  FileCode2,
  FileIcon,
  FileJson,
  FileText,
  FolderIcon,
  ImageIcon,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import * as React from 'react';
import { Panel } from 'react-resizable-panels';
import type { PanelProps } from 'react-resizable-panels';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Code } from '@/ds/components/Code';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { CopyButton } from '@/ds/components/CopyButton';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Tree } from '@/ds/components/Tree';
import { CollapsiblePanel } from '@/lib/resize/collapsible-panel';
import { PanelGroup } from '@/lib/resize/panel-group';
import { PanelSeparator } from '@/lib/resize/separator';
import { cn } from '@/lib/utils';

interface FilesContextValue {
  selectedPath?: string;
  onSelect?: (path: string) => void;
}

const FilesContext = React.createContext<FilesContextValue | undefined>(undefined);

export interface FilesRootProps extends Omit<React.ComponentProps<typeof PanelGroup>, 'children' | 'orientation'> {
  selectedPath?: string;
  onSelect?: (path: string) => void;
  children: React.ReactNode;
}

function FilesRoot({ selectedPath, onSelect, className, children, ...props }: FilesRootProps) {
  const panels = React.Children.toArray(children);

  return (
    <FilesContext.Provider value={{ selectedPath, onSelect }}>
      <PanelGroup orientation="horizontal" className={cn('h-full min-h-0 min-w-0', className)} {...props}>
        {panels.map((panel, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <PanelSeparator /> : null}
            {panel}
          </React.Fragment>
        ))}
      </PanelGroup>
    </FilesContext.Provider>
  );
}

export interface FilesFileTreeProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children' | 'title' | 'onSelect'
> {
  title?: React.ReactNode;
  header?: React.ReactNode;
  hideHeader?: boolean;
  actions?: React.ReactNode;
  selectedPath?: string;
  onSelect?: (path: string) => void;
  loading?: boolean;
  isLoading?: boolean;
  error?: React.ReactNode;
  empty?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  overlays?: React.ReactNode;
  raw?: boolean;
  collapsible?: boolean;
  collapsedSize?: PanelProps['collapsedSize'];
  id?: string;
  defaultSize?: PanelProps['defaultSize'];
  minSize?: PanelProps['minSize'];
  maxSize?: PanelProps['maxSize'];
}

function FilesFileTree({
  title = 'Files',
  header,
  hideHeader,
  actions,
  selectedPath,
  onSelect,
  loading,
  isLoading,
  error,
  empty,
  className,
  children,
  footer,
  overlays,
  raw,
  collapsible,
  collapsedSize,
  id,
  defaultSize = '30%',
  minSize = '15%',
  maxSize,
  ...props
}: FilesFileTreeProps) {
  const files = React.useContext(FilesContext);
  const content = raw ? (
    children
  ) : error ? (
    <div role="alert" className="p-4 text-sm text-red-400">
      {error}
    </div>
  ) : loading || isLoading ? (
    <div className="flex items-center justify-center p-6">
      <Loader2 className="size-5 animate-spin text-neutral3" />
      <span className="sr-only">Loading files</span>
    </div>
  ) : React.Children.count(children) === 0 ? (
    <div className="p-4 text-sm text-neutral4">{empty ?? 'No files'}</div>
  ) : (
    <Tree selectedId={selectedPath ?? files?.selectedPath} onSelect={onSelect ?? files?.onSelect} className="p-2">
      {children}
    </Tree>
  );

  const panelContent = (
    <div className="flex h-full min-h-0 flex-col bg-surface2" {...props}>
      {!hideHeader ? (
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border1 bg-surface3 px-3">
          <div className="min-w-0 truncate text-xs font-semibold text-neutral6">{header ?? title}</div>
          {actions ? <FilesActionMenu label="File tree actions">{actions}</FilesActionMenu> : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">{content}</div>
      {footer}
      {overlays}
    </div>
  );

  if (!files) return panelContent;

  return collapsible ? (
    <CollapsiblePanel
      direction="left"
      id={id}
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      collapsedSize={collapsedSize}
      collapsible
      className={cn('min-w-0', className)}
    >
      {panelContent}
    </CollapsiblePanel>
  ) : (
    <Panel id={id} defaultSize={defaultSize} minSize={minSize} maxSize={maxSize} className={cn('min-w-0', className)}>
      {panelContent}
    </Panel>
  );
}

export interface FilesFolderProps extends Omit<
  React.HTMLAttributes<HTMLLIElement>,
  'id' | 'children' | 'onChange' | 'onLoad'
> {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  metadata?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onLoad?: (id: string) => void;
  loading?: boolean;
  isLoading?: boolean;
}

const FilesFolder = React.forwardRef<HTMLLIElement, FilesFolderProps>(
  (
    {
      id,
      label,
      icon,
      metadata,
      actions,
      children,
      defaultOpen,
      open,
      onOpenChange,
      onLoad,
      loading,
      isLoading,
      className,
      ...props
    },
    ref,
  ) => {
    const handleOpenChange = (nextOpen: boolean) => {
      onOpenChange?.(nextOpen);
      if (nextOpen) onLoad?.(id);
    };

    return (
      <Tree.Folder
        ref={ref}
        id={id}
        defaultOpen={defaultOpen}
        open={open}
        onOpenChange={handleOpenChange}
        className={className}
        {...props}
      >
        <Tree.FolderTrigger
          actions={
            actions ? <FilesActionMenu label={`Actions for ${String(label)}`}>{actions}</FilesActionMenu> : undefined
          }
        >
          <Tree.Icon>
            {loading || isLoading ? (
              <Loader2 aria-label={`Loading ${String(label)}`} className="animate-spin" />
            ) : (
              (icon ?? <FolderIcon />)
            )}
          </Tree.Icon>
          <Tree.Label className="text-xs font-semibold">{label}</Tree.Label>
          {metadata ? <span className="ml-auto shrink-0 text-xs text-neutral3">{metadata}</span> : null}
        </Tree.FolderTrigger>
        <Tree.FolderContent>{children}</Tree.FolderContent>
      </Tree.Folder>
    );
  },
);
FilesFolder.displayName = 'Files.Folder';

function FilesActionMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        aria-label={label}
        className="flex size-7 items-center justify-center rounded-md text-neutral3 transition-colors hover:bg-surface4 hover:text-neutral6"
        onClick={event => event.stopPropagation()}
        onPointerDown={event => event.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" sideOffset={4} className="flex flex-col gap-0.5">
        {children}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']);
const codeExtensions = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'c',
  'cpp',
  'css',
  'scss',
  'html',
  'xml',
  'yaml',
  'yml',
  'toml',
  'sh',
  'bash',
  'zsh',
  'sql',
  'graphql',
  'gql',
  'vue',
  'svelte',
]);

function getFileTypeIcon(path: string) {
  const fileName = path.split('/').pop()?.toLowerCase() ?? path.toLowerCase();
  const extension = fileName.split('.').pop() ?? '';

  if (extension === 'ts' || extension === 'tsx') {
    return <FileCode2 data-testid="file-icon-typescript" className="text-blue-400" />;
  }
  if (extension === 'js' || extension === 'jsx') {
    return <FileCode2 data-testid="file-icon-javascript" className="text-yellow-400" />;
  }
  if (extension === 'json' || fileName === 'package.json' || fileName === 'tsconfig.json') {
    return <FileJson data-testid="file-icon-json" className="text-yellow-500" />;
  }
  if (extension === 'md' || extension === 'mdx') {
    return <FileText data-testid="file-icon-markdown" className="text-sky-400" />;
  }
  if (imageExtensions.has(extension)) {
    return <ImageIcon data-testid="file-icon-image" className="text-purple-400" />;
  }
  if (codeExtensions.has(extension)) {
    return <FileCode2 data-testid="file-icon-code" className="text-emerald-400" />;
  }
  return <FileIcon data-testid="file-icon-generic" className="text-neutral3" />;
}

export interface FilesFileProps extends Omit<React.HTMLAttributes<HTMLLIElement>, 'id' | 'children'> {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  metadata?: React.ReactNode;
  actions?: React.ReactNode;
}

const FilesFile = React.forwardRef<HTMLLIElement, FilesFileProps>(
  ({ id, label, icon, metadata, actions, className, ...props }, ref) => (
    <Tree.File ref={ref} id={id} className={cn('relative', className)} {...props}>
      <Tree.Icon>{icon ?? getFileTypeIcon(id)}</Tree.Icon>
      <Tree.Label className="text-xs font-semibold">{label}</Tree.Label>
      {metadata || actions ? (
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {metadata ? <span className="text-xs text-neutral3">{metadata}</span> : null}
          {actions ? <FilesActionMenu label={`Actions for ${String(label)}`}>{actions}</FilesActionMenu> : null}
        </span>
      ) : null}
    </Tree.File>
  ),
);
FilesFile.displayName = 'Files.File';

type MarkdownView = 'rendered' | 'source';

function stripFrontmatter(markdown: string) {
  const match = /^﻿?---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/.exec(markdown);
  return match ? markdown.slice(match[0].length).replace(/^\s*\n/, '') : markdown;
}

const codeLanguages: Record<string, string> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
};

function FilePathBreadcrumb({ path }: { path: string }) {
  const segments = path.split('/').filter(Boolean);
  const hasFolders = segments.length > 1;

  return (
    <div aria-label="File path" className="flex min-w-max items-center gap-1 text-xs whitespace-nowrap">
      {hasFolders ? (
        <FolderIcon data-testid="file-breadcrumb-folder-icon" className="mr-0.5 size-3.5 shrink-0 text-neutral4" />
      ) : null}
      {segments.map((segment, index) => {
        const isFile = index === segments.length - 1;
        return (
          <span key={`${segment}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight className="size-3 shrink-0 text-neutral3" /> : null}
            <span className={isFile ? 'font-semibold text-neutral6' : 'text-neutral4'}>{segment}</span>
          </span>
        );
      })}
    </div>
  );
}

export interface FilesFilePreviewProps {
  path?: string;
  content?: string;
  mimeType?: string;
  loading?: boolean;
  isLoading?: boolean;
  empty?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  id?: string;
  defaultSize?: PanelProps['defaultSize'];
  minSize?: PanelProps['minSize'];
}

function FilesFilePreview({
  path = '',
  content = '',
  mimeType,
  loading,
  isLoading,
  empty = 'Select a file to preview',
  icon,
  actions,
  className,
  children,
  id,
  defaultSize = '70%',
  minSize = '30%',
}: FilesFilePreviewProps) {
  const fileName = path.split('/').pop() || path;
  const extension = fileName.split('.').pop()?.toLowerCase();
  const isImage =
    mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(extension ?? '');
  const isMarkdown = extension === 'md' || extension === 'mdx';
  const codeLanguage = extension ? codeLanguages[extension] : undefined;
  const [markdownView, setMarkdownView] = React.useState<MarkdownView>('rendered');

  let body: React.ReactNode;
  if (loading || isLoading) {
    body = (
      <div className="flex items-center justify-center py-12" aria-label="Loading file">
        <Loader2 className="size-6 animate-spin text-neutral3" />
      </div>
    );
  } else if (!path) {
    body = <div className="flex h-full items-center justify-center p-6 text-sm text-neutral4">{empty}</div>;
  } else if (children !== undefined) {
    body = children;
  } else if (isImage) {
    body = (
      <div className="flex items-center justify-center p-4">
        <img
          src={`data:${mimeType || 'image/png'};base64,${content}`}
          alt={fileName}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  } else if (isMarkdown && markdownView === 'rendered') {
    body = (
      <div className="w-full max-w-4xl p-8">
        <MarkdownRenderer>{stripFrontmatter(content)}</MarkdownRenderer>
      </div>
    );
  } else if (isMarkdown || extension === 'json') {
    body = (
      <div className="w-full max-w-4xl p-8">
        <CodeEditor
          value={content}
          language={extension === 'json' ? 'json' : 'markdown'}
          editable={false}
          showCopyButton={false}
        />
      </div>
    );
  } else {
    body = (
      <div className="w-full max-w-4xl p-8">
        <Code
          code={content}
          lang={codeLanguage}
          className="overflow-x-auto rounded-lg border border-surface5 bg-surface2 p-4 font-mono text-sm whitespace-pre-wrap text-neutral5"
        />
      </div>
    );
  }

  return (
    <Panel id={id} defaultSize={defaultSize} minSize={minSize} className={cn('min-w-0', className)}>
      <div className="h-full min-w-0 overflow-auto bg-surface1">
        <div className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border1 bg-surface3 px-4">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex min-w-max items-center gap-2">
              {icon}
              <FilePathBreadcrumb path={path} />
            </div>
          </div>
          {isMarkdown || actions || children === undefined ? (
            <div className="flex shrink-0 items-center gap-1">
              {isMarkdown ? (
                <ButtonsGroup spacing="close">
                  <Button
                    variant={markdownView === 'rendered' ? 'default' : 'ghost'}
                    size="xs"
                    aria-pressed={markdownView === 'rendered'}
                    onClick={() => setMarkdownView('rendered')}
                  >
                    Rendered
                  </Button>
                  <Button
                    variant={markdownView === 'source' ? 'default' : 'ghost'}
                    size="xs"
                    aria-pressed={markdownView === 'source'}
                    onClick={() => setMarkdownView('source')}
                  >
                    Source
                  </Button>
                </ButtonsGroup>
              ) : null}
              {actions}
              {children === undefined ? (
                <CopyButton content={content} tooltip="Copy file content" copyMessage="Copied file content" size="sm" />
              ) : null}
            </div>
          ) : null}
        </div>
        {body}
      </div>
    </Panel>
  );
}

export const Files = Object.assign(FilesRoot, {
  FileTree: FilesFileTree,
  Folder: FilesFolder,
  File: FilesFile,
  FilePreview: FilesFilePreview,
});
