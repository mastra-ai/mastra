import { useState } from 'react';
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FileText,
  FileCode,
  FileJson,
  Image,
  Loader2,
  RefreshCw,
  Upload,
  FolderPlus,
  Trash2,
  HardDrive,
  Cloud,
  Database,
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Button } from '@/ds/components/Button';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/ds/components/Tooltip';
import { CopyButton } from '@/ds/components/CopyButton';
import { AmazonIcon } from '@/ds/icons/AmazonIcon';
import { GoogleIcon } from '@/ds/icons/GoogleIcon';
import { AzureIcon } from '@/ds/icons/AzureIcon';
import type { FileEntry, MountInfo } from '../hooks/use-workspace';

// =============================================================================
// Type Definitions
// =============================================================================

export interface FileBrowserProps {
  entries: FileEntry[];
  currentPath: string;
  isLoading: boolean;
  onNavigate: (path: string) => void;
  onFileSelect?: (path: string) => void;
  onRefresh?: () => void;
  onUpload?: () => void;
  onCreateDirectory?: (path: string) => void | Promise<void>;
  onDelete?: (path: string) => void | Promise<void>;
  /** Shows loading state on create directory button */
  isCreatingDirectory?: boolean;
  /** Shows loading state on delete confirmation */
  isDeleting?: boolean;
}

// =============================================================================
// File Icon Helper
// =============================================================================

/**
 * Get icon for a mount point based on provider or icon field.
 */
function getMountIcon(mount: MountInfo) {
  // First check explicit icon field
  const iconKey = mount.icon || mount.provider;

  switch (iconKey) {
    case 'aws-s3':
      // Explicit AWS S3
      return <AmazonIcon className="h-4 w-4 text-[#FF9900]" />;
    case 's3':
      // Generic S3-compatible storage (could be MinIO, R2, etc.)
      return <HardDrive className="h-4 w-4 text-emerald-400" />;
    case 'google-cloud':
    case 'gcs':
      return <GoogleIcon className="h-4 w-4" />;
    case 'azure-blob':
    case 'azure':
      return <AzureIcon className="h-4 w-4 text-[#0078D4]" />;
    case 'cloudflare':
    case 'r2':
      return <Cloud className="h-4 w-4 text-[#F38020]" />;
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
      return <Cloud className="h-4 w-4 text-icon4" />;
  }
}

function getFileIcon(name: string, type: 'file' | 'directory', isOpen = false, mount?: MountInfo) {
  if (type === 'directory') {
    // If it's a mount point, show the provider icon
    if (mount) {
      return getMountIcon(mount);
    }
    return isOpen ? <FolderOpen className="h-4 w-4 text-amber-400" /> : <Folder className="h-4 w-4 text-amber-400" />;
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
      return <FileText className="h-4 w-4 text-icon4" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="h-4 w-4 text-purple-400" />;
    default:
      return <File className="h-4 w-4 text-icon4" />;
  }
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// =============================================================================
// Breadcrumb Navigation
// =============================================================================

interface BreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  const parts = path.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-1 text-sm overflow-x-auto">
      <button
        onClick={() => onNavigate('/')}
        className="px-2 py-1 rounded hover:bg-surface4 text-icon5 hover:text-icon6 transition-colors"
      >
        /
      </button>
      {parts.map((part, index) => {
        const partPath = '/' + parts.slice(0, index + 1).join('/');
        return (
          <div key={partPath} className="flex items-center">
            <ChevronRight className="h-4 w-4 text-icon3" />
            <button
              onClick={() => onNavigate(partPath)}
              className="px-2 py-1 rounded hover:bg-surface4 text-icon5 hover:text-icon6 transition-colors truncate max-w-[150px]"
              title={part}
            >
              {part}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// File Browser Component
// =============================================================================

export function FileBrowser({
  entries,
  currentPath,
  isLoading,
  onNavigate,
  onFileSelect,
  onRefresh,
  onUpload,
  onCreateDirectory,
  onDelete,
  isCreatingDirectory,
  isDeleting,
}: FileBrowserProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Sort entries: directories first, then alphabetically
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  const handleEntryClick = (entry: FileEntry) => {
    const fullPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    if (entry.type === 'directory') {
      onNavigate(fullPath);
    } else {
      onFileSelect?.(fullPath);
    }
  };

  const handleDelete = (entry: FileEntry) => {
    const fullPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    setDeleteTarget(fullPath);
  };

  return (
    <div className="rounded-lg border border-border1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface3 border-b border-border1">
        <Breadcrumb path={currentPath} onNavigate={onNavigate} />
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button variant="ghost" size="md" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {onCreateDirectory && (
            <Button
              variant="ghost"
              size="md"
              disabled={isCreatingDirectory}
              onClick={() => {
                const name = prompt('Directory name:');
                if (name) {
                  const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
                  onCreateDirectory(fullPath);
                }
              }}
            >
              {isCreatingDirectory ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            </Button>
          )}
          {onUpload && (
            <Button variant="ghost" size="md" onClick={onUpload}>
              <Upload className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* File List */}
      <div className="max-h-[400px] overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-icon3" />
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="py-12 text-center text-icon4 text-sm">
            {currentPath === '/' ? 'Workspace is empty' : 'Directory is empty'}
          </div>
        ) : (
          <ul>
            {/* Parent directory link */}
            {currentPath !== '/' && (
              <li>
                <button
                  onClick={() => {
                    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
                    onNavigate(parentPath);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface4 transition-colors text-left"
                >
                  <FolderOpen className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-icon5">..</span>
                </button>
              </li>
            )}
            {sortedEntries.map(entry => {
              const icon = getFileIcon(entry.name, entry.type, false, entry.mount);
              const mountLabel = entry.mount?.displayName || entry.mount?.provider;

              return (
                <li key={entry.name} className="group">
                  <div className="flex items-center hover:bg-surface4 transition-colors">
                    <button
                      onClick={() => handleEntryClick(entry)}
                      className="flex-1 flex items-center gap-3 px-4 py-2 text-left"
                    >
                      {icon}
                      <span className="text-sm text-icon6 flex-1 truncate">{entry.name}</span>
                      {entry.mount &&
                        mountLabel &&
                        (entry.mount.description ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-icon3 bg-surface4 px-1.5 py-0.5 rounded">
                                  {mountLabel}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{entry.mount.description}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-icon3 bg-surface4 px-1.5 py-0.5 rounded">{mountLabel}</span>
                        ))}
                      {entry.type === 'file' && entry.size !== undefined && (
                        <span className="text-xs text-icon3 tabular-nums">{formatBytes(entry.size)}</span>
                      )}
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => handleDelete(entry)}
                        className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-400 text-icon3 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
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
                if (deleteTarget && onDelete) {
                  try {
                    await onDelete(deleteTarget);
                    setDeleteTarget(null);
                  } catch {
                    // Error toast is shown by the hook, just close dialog
                    setDeleteTarget(null);
                  }
                }
              }}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// File Viewer Component
// =============================================================================

/**
 * Map file extensions to Shiki language names for syntax highlighting.
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
 * Highlighted code display component using Prism (same as chat).
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
          fontFamily: 'var(--geist-mono), ui-monospace, monospace',
        },
      }}
    >
      {content}
    </SyntaxHighlighter>
  );
}

export interface FileViewerProps {
  path: string;
  content: string;
  isLoading: boolean;
  mimeType?: string;
  onClose?: () => void;
}

export function FileViewer({ path, content, isLoading, mimeType, onClose }: FileViewerProps) {
  const fileName = path.split('/').pop() || path;
  const ext = fileName.split('.').pop()?.toLowerCase();
  const isImage = mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '');
  const language = getLanguageFromExtension(ext);

  return (
    <div className="rounded-lg border border-border1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface3 border-b border-border1">
        <div className="flex items-center gap-2">
          {getFileIcon(fileName, 'file')}
          <span className="text-sm font-medium text-icon6">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton content={content} copyMessage="Copied file content" />
          {onClose && (
            <Button variant="ghost" size="md" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-auto h-full" style={{ backgroundColor: 'black' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-icon3" />
          </div>
        ) : isImage ? (
          <div className="p-4 flex items-center justify-center">
            <img
              src={`data:${mimeType || 'image/png'};base64,${btoa(content)}`}
              alt={fileName}
              className="max-w-full max-h-[400px] object-contain"
            />
          </div>
        ) : language ? (
          <HighlightedCode content={content} language={language} />
        ) : (
          <pre className="p-4 text-sm text-icon5 whitespace-pre-wrap font-mono overflow-x-auto">{content}</pre>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Workspace Not Configured Component
// =============================================================================

export function WorkspaceNotConfigured() {
  return (
    <div className="grid place-items-center py-16">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="p-4 rounded-full bg-surface4 mb-4">
          <Folder className="h-8 w-8 text-icon3" />
        </div>
        <h2 className="text-lg font-medium text-icon6 mb-2">Workspace Not Configured</h2>
        <p className="text-sm text-icon4 mb-6">
          No workspace is configured. Add a workspace to your Mastra configuration to manage files, skills, and enable
          semantic search.
        </p>
        <Button size="lg" variant="default" as="a" href="https://mastra.ai/en/docs/workspace/overview" target="_blank">
          Learn about Workspaces
        </Button>
      </div>
    </div>
  );
}
