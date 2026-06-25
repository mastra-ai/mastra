import { AmazonIcon, AzureIcon, GoogleIcon, SkillIcon } from '@mastra/playground-ui';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Input } from '@mastra/playground-ui/components/Input';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Tree } from '@mastra/playground-ui/components/Tree';
import {
  File,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  Image,
  Loader2,
  RefreshCw,
  Upload,
  FolderPlus,
  Trash2,
  AlertCircle,
  Cloud,
  Database,
  HardDrive,
  Wand2,
  Search,
  X,
  ChevronRight,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import type { FileEntry } from '../types';
import { cn } from '@/lib/utils';

// =============================================================================
// Type Definitions
// =============================================================================

export interface FileBrowserProps {
  entries: FileEntry[];
  currentPath: string;
  isLoading: boolean;
  /** Error from fetching files (e.g., directory not found) */
  error?: Error | null;
  onNavigate: (path: string) => void;
  onFileSelect?: (path: string) => void;
  /** Currently selected file path, highlighted in the tree. */
  selectedPath?: string;
  /**
   * Set of skill *directory* paths. Folders whose path is in this set are
   * rendered with a skill icon to mark them as first-class skills. They still
   * expand/collapse like any folder; the rich view lives on their SKILL.md.
   */
  skillPaths?: ReadonlySet<string>;
  onRefresh?: () => void;
  onUpload?: () => void;
  onCreateDirectory?: (path: string) => void | Promise<void>;
  onDelete?: (path: string) => void | Promise<void>;
  /** When provided, shows an "add skill" action in the file tree header. */
  onAddSkill?: () => void;
  /** When provided, shows a search toggle in the file tree header. */
  onToggleSearch?: () => void;
  /** Whether the search view is currently active (controls the search toggle icon/tooltip). */
  isSearchActive?: boolean;
  /** Shows loading state on create directory button */
  isCreatingDirectory?: boolean;
  /** Shows loading state on delete confirmation */
  isDeleting?: boolean;
  /**
   * Called when a folder is expanded so its children can be lazily loaded.
   * When provided, folders start collapsed instead of open.
   */
  onLoadFolder?: (path: string) => void;
  /** Set of folder paths currently loading their children. */
  loadingPaths?: ReadonlySet<string>;
}

// =============================================================================
// File Icon Helper
// =============================================================================

/**
 * Get icon for a mount point based on provider or icon field.
 */
function getMountIcon(mount: FileEntry['mount']) {
  if (!mount) return null;

  // First check explicit icon field, then fall back to provider
  const iconKey = mount.icon || mount.provider;

  switch (iconKey) {
    case 'aws-s3':
    case 's3':
      // S3 or S3-compatible storage
      return <AmazonIcon className="h-4 w-4 text-[#FF9900]" />;
    case 'google-cloud':
    case 'google-cloud-storage':
    case 'gcs':
      return <GoogleIcon className="h-4 w-4" />;
    case 'azure-blob':
    case 'azure':
      return <AzureIcon className="h-4 w-4 text-[#0078D4]" />;
    case 'cloudflare':
    case 'cloudflare-r2':
    case 'r2':
      return <Cloud className="h-4 w-4 text-[#F38020]" />;
    case 'minio':
      return <HardDrive className="h-4 w-4 text-red-400" />;
    case 'database':
      return <Database className="h-4 w-4 text-emerald-400" />;
    case 'local':
    case 'folder':
      return <Folder className="h-4 w-4 text-amber-400" />;
    case 'hard-drive':
      return <HardDrive className="h-4 w-4 text-slate-400" />;
    case 'cloud':
      return <Cloud className="h-4 w-4 text-sky-400" />;
    default:
      // Default to cloud icon for unknown providers
      return <Cloud className="h-4 w-4 text-neutral4" />;
  }
}

function getFileIcon(entry: FileEntry, isOpen = false, isSkillLocation = false) {
  const { name, type, mount } = entry;

  if (type === 'directory') {
    // If it's a mount point, show the provider icon
    if (mount) {
      return getMountIcon(mount);
    }
    const folderColor = isSkillLocation ? 'text-accent1' : 'text-amber-400';
    return isOpen ? (
      <FolderOpen className={cn('h-4 w-4', folderColor)} />
    ) : (
      <Folder className={cn('h-4 w-4', folderColor)} />
    );
  }

  // Skill files use the accent color to visually group them with their folder.
  if (isSkillLocation) {
    return <FileText className="h-4 w-4 text-accent1" />;
  }

  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="h-4 w-4 text-blue-400" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-yellow-400" />;
    case 'md':
    case 'mdx':
      return <FileText className="h-4 w-4 text-neutral4" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="h-4 w-4 text-purple-400" />;
    default:
      return <File className="h-4 w-4 text-neutral4" />;
  }
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '';
  if (bytes < 0) return '-' + formatBytes(-bytes);
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Extract a user-friendly error message from an error.
 * Checks for MastraClientError.body first, then falls back to parsing the message.
 */
function getErrorMessage(error: Error): string {
  // Check for MastraClientError with body property
  if ('body' in error && error.body && typeof error.body === 'object') {
    const body = error.body as Record<string, unknown>;
    if (typeof body.error === 'string') return body.error;
    if (typeof body.message === 'string') return body.message;
  }

  // Fallback: parse the message for older client-js versions
  const message = error.message;

  // Try to extract JSON error message from client-js format: "HTTP error! status: 404 - {...}"
  // Avoid regex to prevent ReDoS - just find the last " - {" and try to parse from there
  const jsonStart = message.lastIndexOf(' - {');
  if (jsonStart !== -1) {
    try {
      const jsonStr = message.slice(jsonStart + 3); // Skip " - "
      const parsed = JSON.parse(jsonStr);
      if (parsed.error) return parsed.error;
      if (parsed.message) return parsed.message;
    } catch {
      // Fall through to default
    }
  }

  // Check for common patterns
  if (message.includes('status: 404')) {
    return 'Directory not found';
  }

  return message;
}

function isRootPath(p: string) {
  return p === '.' || p === '';
}

interface FileTreeNode {
  name: string;
  path: string;
  entry: FileEntry;
  children: FileTreeNode[];
}

function normalizeEntryPath(entry: FileEntry, currentPath: string): string {
  if (entry.name === '.' || entry.name === '') return '.';
  if (isRootPath(currentPath) || entry.name.startsWith(`${currentPath}/`)) return entry.name;
  return `${currentPath}/${entry.name}`;
}

function createDirectoryEntry(name: string): FileEntry {
  return { name, type: 'directory' };
}

function buildFileTree(entries: FileEntry[], currentPath: string): FileTreeNode[] {
  const roots = new Map<string, FileTreeNode>();
  const nodes = new Map<string, FileTreeNode>();

  const ensureDirectory = (path: string) => {
    const existing = nodes.get(path);
    if (existing) return existing;

    const parts = path.split('/').filter(Boolean);
    const name = parts.at(-1) ?? path;
    const node: FileTreeNode = { name, path, entry: createDirectoryEntry(name), children: [] };
    nodes.set(path, node);

    if (parts.length === 1) {
      roots.set(path, node);
    } else {
      const parent = ensureDirectory(parts.slice(0, -1).join('/'));
      parent.children.push(node);
    }

    return node;
  };

  for (const entry of entries) {
    const path = normalizeEntryPath(entry, currentPath);
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    for (let index = 1; index < parts.length; index++) {
      ensureDirectory(parts.slice(0, index).join('/'));
    }

    // Reuse any placeholder directory node created for this path so a real
    // entry merges into it rather than appearing as a duplicate sibling.
    const existing = nodes.get(path);
    let node: FileTreeNode;
    if (existing) {
      existing.entry = entry;
      existing.name = parts.at(-1) ?? entry.name;
      node = existing;
    } else {
      node = { name: parts.at(-1) ?? entry.name, path, entry, children: [] };
      nodes.set(path, node);
    }

    if (parts.length === 1) {
      roots.set(path, node);
    } else {
      const parent = ensureDirectory(parts.slice(0, -1).join('/'));
      if (!parent.children.some(child => child.path === path)) {
        parent.children.push(node);
      }
    }
  }

  const sortNodes = (items: FileTreeNode[]): FileTreeNode[] =>
    items
      .map(item => ({ ...item, children: sortNodes(item.children) }))
      .sort((a: FileTreeNode, b: FileTreeNode) => {
        if (a.entry.type === 'directory' && b.entry.type !== 'directory') return -1;
        if (a.entry.type !== 'directory' && b.entry.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });

  return sortNodes(Array.from(roots.values()));
}

// =============================================================================
// File Browser Component
// =============================================================================

export function FileBrowser({
  entries,
  currentPath,
  isLoading,
  error,
  onFileSelect,
  selectedPath,
  skillPaths,
  onRefresh,
  onUpload,
  onCreateDirectory,
  onDelete,
  onAddSkill,
  onToggleSearch,
  isSearchActive,
  isCreatingDirectory,
  isDeleting,
  onLoadFolder,
  loadingPaths,
}: FileBrowserProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  // Parent path under which a new folder is being created. '.' means workspace root.
  const [createParent, setCreateParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const lazy = !!onLoadFolder;
  const tree = useMemo(() => buildFileTree(entries, currentPath), [entries, currentPath]);

  const handleDelete = (path: string) => {
    setDeleteTarget(path);
  };

  const closeCreateDialog = () => {
    setCreateParent(null);
    setNewFolderName('');
  };

  const submitCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || createParent === null || !onCreateDirectory) return;
    const path = isRootPath(createParent) ? name : `${createParent}/${name}`;
    try {
      await onCreateDirectory(path);
    } finally {
      closeCreateDialog();
    }
  };

  const renderMetadata = (node: FileTreeNode) => {
    const { entry } = node;
    const mountLabel = entry.mount?.displayName || entry.mount?.provider;
    const isError = entry.mount?.status === 'error';

    return (
      <>
        {entry.mount && isError && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <span className="text-red-400">Error:</span> {entry.mount.error || 'Failed to connect to this filesystem'}
            </TooltipContent>
          </Tooltip>
        )}
        {entry.mount &&
          mountLabel &&
          (entry.mount.description ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className={`text-xs px-1.5 py-0.5 rounded ${isError ? 'text-red-400 bg-red-400/10' : 'text-neutral3 bg-surface4'}`}
                >
                  {mountLabel}
                </span>
              </TooltipTrigger>
              <TooltipContent>{entry.mount.description}</TooltipContent>
            </Tooltip>
          ) : (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${isError ? 'text-red-400 bg-red-400/10' : 'text-neutral3 bg-surface4'}`}
            >
              {mountLabel}
            </span>
          ))}
        {entry.type === 'file' && entry.size !== undefined && (
          <span className="text-xs text-neutral3 tabular-nums">{formatBytes(entry.size)}</span>
        )}
      </>
    );
  };

  const renderFolderActions = (node: FileTreeNode) => (
    <>
      {onCreateDirectory && (
        <button
          onClick={event => {
            event.stopPropagation();
            setNewFolderName('');
            setCreateParent(node.path);
          }}
          disabled={isCreatingDirectory}
          aria-label={`Create folder in ${node.name}`}
          className="p-1 opacity-0 group-hover:opacity-100 hover:text-neutral6 text-neutral3 transition-all disabled:opacity-50"
        >
          {isCreatingDirectory ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderPlus className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      {renderDeleteAction(node)}
    </>
  );

  const renderDeleteAction = (node: FileTreeNode) =>
    onDelete &&
    !node.entry.mount && (
      <button
        onClick={event => {
          event.stopPropagation();
          handleDelete(node.path);
        }}
        aria-label={`Delete ${node.name}`}
        className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-400 text-neutral3 transition-all"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );

  const selectFileFromEventTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement) || target.closest('button')) return;
    const item = target.closest<HTMLElement>('[data-tree-item-kind="file"]');
    const id = item?.dataset.treeItemId;
    if (id) {
      onFileSelect?.(id);
    }
  };

  const isSkillsPath = (path: string) => path === '.agents/skills' || path.startsWith('.agents/skills/');

  // Accent left-bar drawn on the selected row to echo the reference design.
  const selectedBarClass =
    'relative before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-accent1';

  const renderNode = (node: FileTreeNode, depth = 0) => {
    const isSkillLocation = isSkillsPath(node.path);
    const isSkillRoot = skillPaths?.has(node.path) ?? false;
    const isSelected = selectedPath != null && selectedPath === node.path;

    if (node.entry.type === 'directory') {
      const isFolderLoading = loadingPaths?.has(node.path) ?? false;
      return (
        <Tree.Folder
          key={node.path}
          id={node.path}
          defaultOpen={!lazy}
          onOpenChange={open => {
            if (open && lazy) onLoadFolder?.(node.path);
          }}
          data-workspace-tree-location={isSkillLocation ? 'skills' : undefined}
        >
          <Tree.FolderTrigger actions={renderFolderActions(node)}>
            <Tree.Icon>
              {isFolderLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-neutral4" />
              ) : isSkillRoot ? (
                <SkillIcon className="h-4 w-4 text-accent1" />
              ) : (
                getFileIcon(node.entry, true)
              )}
            </Tree.Icon>
            <Tree.Label className={cn('text-sm flex-1 text-neutral6', isSkillRoot && 'font-medium')}>
              {node.name}
            </Tree.Label>
            {renderMetadata(node)}
          </Tree.FolderTrigger>
          {node.children.length > 0 && (
            <Tree.FolderContent className="relative">
              {/* Indent guide — a hairline under the parent chevron. The span carries
                  no tree role, so the Tree's keyboard/aria logic ignores it. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-border1"
                style={{ left: depth * 12 + 13 }}
              />
              {node.children.map(child => renderNode(child, depth + 1))}
            </Tree.FolderContent>
          )}
        </Tree.Folder>
      );
    }

    return (
      <Tree.File
        key={node.path}
        id={node.path}
        data-workspace-tree-location={isSkillLocation ? 'skills' : undefined}
        className={cn(isSelected && selectedBarClass)}
      >
        <span
          className="flex min-w-0 flex-1 items-center gap-1.5"
          onClick={() => onFileSelect?.(node.path)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onFileSelect?.(node.path);
            }
          }}
        >
          <Tree.Icon>{getFileIcon(node.entry, false)}</Tree.Icon>
          <Tree.Label className="text-sm flex-1 text-neutral6">{node.name}</Tree.Label>
          {renderMetadata(node)}
        </span>
        {renderDeleteAction(node)}
      </Tree.File>
    );
  };

  return (
    <div className="h-full overflow-hidden">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border1 bg-surface3 px-4">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral6">
          <FolderOpen className="h-4 w-4 text-amber-400" />
          <span>Files</span>
        </div>
        <div className="flex items-center gap-1">
          {onToggleSearch && (
            <Button
              variant="ghost"
              size="icon-md"
              onClick={onToggleSearch}
              tooltip={isSearchActive ? 'Close search' : 'Search workspace'}
              aria-label={isSearchActive ? 'Close search' : 'Search workspace'}
              aria-pressed={isSearchActive}
            >
              {isSearchActive ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
          )}
          {onAddSkill && (
            <Button variant="ghost" size="icon-md" onClick={onAddSkill} tooltip="Add skill" aria-label="Add skill">
              <Wand2 className="h-4 w-4" />
            </Button>
          )}
          {onCreateDirectory && (
            <Button
              variant="ghost"
              size="icon-md"
              onClick={() => {
                setNewFolderName('');
                setCreateParent('.');
              }}
              disabled={isCreatingDirectory}
              tooltip="Create folder"
              aria-label="Create folder at workspace root"
            >
              {isCreatingDirectory ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            </Button>
          )}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon-md"
              onClick={onRefresh}
              disabled={isLoading}
              tooltip="Refresh files"
              aria-label="Refresh files"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {onUpload && (
            <Button variant="ghost" size="icon-md" onClick={onUpload} tooltip="Upload files" aria-label="Upload files">
              <Upload className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* File Tree */}
      <div className="h-full overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-neutral3" />
          </div>
        ) : error ? (
          <div className="py-12 px-4 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-4">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
            <p className="text-sm text-neutral6 font-medium mb-1">Failed to load directory</p>
            <p className="text-xs text-neutral4 max-w-sm mx-auto">{getErrorMessage(error)}</p>
          </div>
        ) : tree.length === 0 ? (
          <div className="py-12 text-center text-neutral4 text-sm">Workspace is empty</div>
        ) : (
          <TooltipProvider>
            <div
              onClickCapture={event => selectFileFromEventTarget(event.target)}
              onKeyDownCapture={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  selectFileFromEventTarget(event.target);
                }
              }}
            >
              <Tree selectedId={selectedPath}>{tree.map(node => renderNode(node, 0))}</Tree>
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !isDeleting && !open && setDeleteTarget(null)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete Item</AlertDialog.Title>
            <AlertDialog.Description>
              Are you sure you want to delete "{deleteTarget}"? This action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              disabled={isDeleting}
              onClick={async () => {
                try {
                  if (deleteTarget && onDelete) {
                    await onDelete(deleteTarget);
                  }
                } finally {
                  setDeleteTarget(null);
                }
              }}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>

      {/* Create Folder */}
      <AlertDialog
        open={createParent !== null}
        onOpenChange={open => !isCreatingDirectory && !open && closeCreateDialog()}
      >
        <AlertDialog.Content>
          <form
            onSubmit={event => {
              event.preventDefault();
              void submitCreateFolder();
            }}
          >
            <AlertDialog.Header>
              <AlertDialog.Title>New folder</AlertDialog.Title>
              <AlertDialog.Description>
                {createParent && !isRootPath(createParent)
                  ? `Create a folder inside "${createParent}".`
                  : 'Create a folder at the workspace root.'}
              </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <Input
                autoFocus
                value={newFolderName}
                onChange={event => setNewFolderName(event.target.value)}
                placeholder="Folder name"
                aria-label="Folder name"
                disabled={isCreatingDirectory}
              />
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <AlertDialog.Cancel type="button" disabled={isCreatingDirectory}>
                Cancel
              </AlertDialog.Cancel>
              <Button type="submit" variant="primary" size="lg" disabled={isCreatingDirectory || !newFolderName.trim()}>
                {isCreatingDirectory ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </AlertDialog.Footer>
          </form>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// File Viewer Component
// =============================================================================

/**
 * Map file extensions to Prism language names for syntax highlighting.
 */
function getLanguageFromExtension(ext?: string): string | null {
  if (!ext) return null;
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    json: 'json',
    md: 'markdown',
    mdx: 'mdx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    vue: 'vue',
    svelte: 'svelte',
  };
  return map[ext.toLowerCase()] || null;
}

/**
 * Highlighted code display component using Prism.
 */
function HighlightedCode({ content, language }: { content: string; language: string }) {
  return (
    <SyntaxHighlighter
      language={language}
      style={coldarkDark}
      customStyle={{
        margin: 0,
        padding: '1rem',
        backgroundColor: 'transparent',
        fontSize: '0.875rem',
      }}
      codeTagProps={{
        style: {
          fontFamily: 'var(--font-mono)',
        },
      }}
    >
      {content}
    </SyntaxHighlighter>
  );
}

/**
 * Strip a leading YAML frontmatter block (`---\n…\n---`) from markdown so the
 * rendered view shows the document body, not the raw metadata. The frontmatter
 * stays visible in the "Source" view.
 */
function stripFrontmatter(markdown: string): string {
  const match = /^﻿?---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/.exec(markdown);
  return match ? markdown.slice(match[0].length).replace(/^\s*\n/, '') : markdown;
}

export interface FileViewerProps {
  path: string;
  content: string;
  isLoading: boolean;
  mimeType?: string;
}

type MarkdownView = 'rendered' | 'source';

/**
 * Breadcrumb of the file path shown in the viewer header (reference `.file-crumb`),
 * with each segment muted and the file name emphasized.
 */
function FilePathBreadcrumb({ path }: { path: string }) {
  const segments = path.split('/').filter(Boolean);
  return (
    <div className="flex min-w-0 items-center gap-1 text-sm">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={`${segment}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral3" />}
            <span className={cn('truncate', isLast ? 'font-medium text-neutral6' : 'text-neutral4')}>{segment}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Rendered | Source segmented toggle for markdown files (reference `.seg-toggle`). */
function MarkdownViewToggle({ value, onChange }: { value: MarkdownView; onChange: (value: MarkdownView) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border1 bg-surface4 p-0.5">
      {(['rendered', 'source'] as const).map(option => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            'rounded-sm px-2 py-0.5 text-xs font-medium capitalize transition-colors',
            value === option ? 'bg-surface2 text-neutral6' : 'text-neutral4 hover:text-neutral5',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function FileViewer({ path, content, isLoading, mimeType }: FileViewerProps) {
  const fileName = path.split('/').pop() || path;
  const ext = fileName.split('.').pop()?.toLowerCase();
  const isImage = mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '');
  const isMarkdown = ext === 'md' || ext === 'mdx';
  const language = getLanguageFromExtension(ext);
  // Markdown opens rendered by default, with a toggle to inspect the raw source.
  const [markdownView, setMarkdownView] = useState<MarkdownView>('rendered');

  return (
    // Single scroll container so the header can stick + frost over the content,
    // and so short files size to their content instead of leaving a tall void.
    <div className="h-full min-w-0 overflow-auto bg-surface1">
      {/* Sticky header — solid surface3 to match the file-tree header. */}
      <div className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-border1 bg-surface3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {getFileIcon({ name: fileName, type: 'file' })}
          <FilePathBreadcrumb path={path} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isMarkdown && <MarkdownViewToggle value={markdownView} onChange={setMarkdownView} />}
          <CopyButton content={content} copyMessage="Copied file content" variant="ghost" />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-neutral3" />
        </div>
      ) : isImage ? (
        <div className="p-4 flex items-center justify-center">
          <img
            src={`data:${mimeType || 'image/png'};base64,${btoa(content)}`}
            alt={fileName}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : isMarkdown && markdownView === 'rendered' ? (
        <div className="w-full max-w-4xl px-8 py-8">
          <MarkdownRenderer>{stripFrontmatter(content)}</MarkdownRenderer>
        </div>
      ) : isMarkdown || ext === 'json' ? (
        <div className="w-full max-w-4xl px-8 py-8">
          <div className="overflow-hidden rounded-lg border border-surface5">
            <CodeEditor
              value={content}
              language={ext === 'json' ? 'json' : 'markdown'}
              editable={false}
              showCopyButton={false}
              className="rounded-none border-0 [&_.cm-gutterElement]:w-6"
            />
          </div>
        </div>
      ) : language ? (
        <div className="w-full max-w-4xl px-8 py-8">
          <div className="overflow-hidden rounded-lg border border-surface5">
            <HighlightedCode content={content} language={language} />
          </div>
        </div>
      ) : (
        <div className="w-full max-w-4xl px-8 py-8">
          <pre className="overflow-x-auto rounded-lg border border-surface5 bg-surface2 p-4 font-mono text-sm whitespace-pre-wrap text-neutral5">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
