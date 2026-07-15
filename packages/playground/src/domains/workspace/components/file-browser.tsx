import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { Files } from '@mastra/playground-ui/components/Files';
import { Input } from '@mastra/playground-ui/components/Input';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { AmazonIcon } from '@mastra/playground-ui/icons/AmazonIcon';
import { AzureIcon } from '@mastra/playground-ui/icons/AzureIcon';
import { GoogleIcon } from '@mastra/playground-ui/icons/GoogleIcon';
import { SkillIcon } from '@mastra/playground-ui/icons/SkillIcon';
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
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
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
  footer?: ReactNode;
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
  footer,
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

  const isSkillsPath = (path: string) => path === '.agents/skills' || path.startsWith('.agents/skills/');

  const renderNode = (node: FileTreeNode) => {
    const isSkillLocation = isSkillsPath(node.path);
    const isSkillRoot = skillPaths?.has(node.path) ?? false;

    if (node.entry.type === 'directory') {
      return (
        <Files.Folder
          key={node.path}
          id={node.path}
          label={node.name}
          icon={isSkillRoot ? <SkillIcon className="h-4 w-4 text-accent1" /> : getFileIcon(node.entry, true)}
          metadata={renderMetadata(node)}
          actions={renderFolderActions(node)}
          defaultOpen={!lazy}
          onLoad={lazy ? onLoadFolder : undefined}
          loading={loadingPaths?.has(node.path)}
          data-workspace-tree-location={isSkillLocation ? 'skills' : undefined}
          className={cn(isSkillRoot && 'font-medium')}
        >
          {node.children.map(renderNode)}
        </Files.Folder>
      );
    }

    return (
      <Files.File
        key={node.path}
        id={node.path}
        label={node.name}
        icon={getFileIcon(node.entry, false)}
        metadata={renderMetadata(node)}
        actions={renderDeleteAction(node)}
        data-workspace-tree-location={isSkillLocation ? 'skills' : undefined}
      />
    );
  };

  return (
    <Files.FileTree
      selectedPath={selectedPath}
      onSelect={onFileSelect}
      title={
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-amber-400" />
          <span>Files</span>
        </div>
      }
      actions={
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
      }
      collapsible
      id="workspace-file-tree"
      minSize={200}
      maxSize="50%"
      defaultSize={320}
      collapsedSize={60}
      footer={footer}
      loading={isLoading}
      error={error ? getErrorMessage(error) : undefined}
      empty="Workspace is empty"
      overlays={
        <>
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
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={isCreatingDirectory || !newFolderName.trim()}
                  >
                    {isCreatingDirectory ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create
                  </Button>
                </AlertDialog.Footer>
              </form>
            </AlertDialog.Content>
          </AlertDialog>
        </>
      }
    >
      <TooltipProvider>{tree.map(renderNode)}</TooltipProvider>
    </Files.FileTree>
  );
}
