import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { AmazonIcon } from '@mastra/playground-ui/icons/AmazonIcon';
import { AzureIcon } from '@mastra/playground-ui/icons/AzureIcon';
import { GoogleIcon } from '@mastra/playground-ui/icons/GoogleIcon';
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
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
} from 'lucide-react';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkCold, coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import type { FileEntry } from '../types';

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
      return <Cloud className="text-neutral4 h-4 w-4" />;
  }
}

function getFileIcon(entry: FileEntry, isOpen = false) {
  const { name, type, mount } = entry;

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
      return <FileText className="text-neutral4 h-4 w-4" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="h-4 w-4 text-purple-400" />;
    default:
      return <File className="text-neutral4 h-4 w-4" />;
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

// =============================================================================
// Breadcrumb Navigation
// =============================================================================

function isRootPath(p: string) {
  return p === '.' || p === '';
}

interface BreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  const isRoot = isRootPath(path);
  const parts = isRoot ? [] : path.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-1 overflow-x-auto text-sm">
      <button
        onClick={() => onNavigate('.')}
        className="hover:bg-surface4 text-neutral5 hover:text-neutral6 rounded p-1 transition-colors"
        aria-label="Workspace root"
      >
        <FolderOpen className="h-4 w-4" />
      </button>
      {parts.map((part, index) => {
        const partPath = parts.slice(0, index + 1).join('/');
        return (
          <div key={partPath} className="flex items-center">
            <ChevronRight className="text-neutral3 h-4 w-4" />
            <button
              onClick={() => onNavigate(partPath)}
              className="hover:bg-surface4 text-neutral5 hover:text-neutral6 max-w-[150px] truncate rounded px-2 py-1 transition-colors"
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
  error,
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

  const isRoot = isRootPath(currentPath);

  const handleEntryClick = (entry: FileEntry) => {
    const fullPath = isRoot ? entry.name : `${currentPath}/${entry.name}`;
    if (entry.type === 'directory') {
      onNavigate(fullPath);
    } else {
      onFileSelect?.(fullPath);
    }
  };

  const handleDelete = (entry: FileEntry) => {
    const fullPath = isRoot ? entry.name : `${currentPath}/${entry.name}`;
    setDeleteTarget(fullPath);
  };

  return (
    <div className="border-border1 overflow-hidden rounded-lg border">
      {/* Header */}
      <div className="bg-surface3 border-border1 flex items-center justify-between border-b px-4 py-2">
        <Breadcrumb path={currentPath} onNavigate={onNavigate} />
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button variant="ghost" size="md" onClick={onRefresh} disabled={isLoading} aria-label="Refresh files">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {onCreateDirectory && (
            <Button
              variant="ghost"
              size="md"
              disabled={isCreatingDirectory}
              aria-label="Create directory"
              onClick={() => {
                const name = prompt('Directory name:');
                if (name) {
                  const fullPath = isRoot ? name : `${currentPath}/${name}`;
                  void onCreateDirectory(fullPath);
                }
              }}
            >
              {isCreatingDirectory ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            </Button>
          )}
          {onUpload && (
            <Button variant="ghost" size="md" onClick={onUpload} aria-label="Upload files">
              <Upload className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* File List */}
      <div className="max-h-[400px] overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-neutral3 h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="px-4 py-12 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
            <p className="text-neutral6 mb-1 text-sm font-medium">Failed to load directory</p>
            <p className="text-neutral4 mx-auto max-w-sm text-xs">{getErrorMessage(error)}</p>
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="text-neutral4 py-12 text-center text-sm">
            {isRoot ? 'Workspace is empty' : 'Directory is empty'}
          </div>
        ) : (
          <TooltipProvider>
            <ul>
              {/* Parent directory link */}
              {!isRoot && (
                <li>
                  <button
                    onClick={() => {
                      const parentPath = currentPath.split('/').slice(0, -1).join('/') || '.';
                      onNavigate(parentPath);
                    }}
                    className="hover:bg-surface4 flex w-full items-center gap-3 px-4 py-2 text-left transition-colors"
                  >
                    <FolderOpen className="h-4 w-4 text-amber-400" />
                    <span className="text-neutral5 text-sm">..</span>
                  </button>
                </li>
              )}
              {sortedEntries.map(entry => {
                const mountLabel = entry.mount?.displayName || entry.mount?.provider;
                const isError = entry.mount?.status === 'error';

                return (
                  <li key={entry.name} className="group">
                    <div className="hover:bg-surface4 flex items-center transition-colors">
                      <button
                        onClick={() => handleEntryClick(entry)}
                        className="flex flex-1 items-center gap-3 px-4 py-2 text-left"
                      >
                        {getFileIcon(entry)}
                        <span className="text-neutral6 flex-1 truncate text-sm">{entry.name}</span>
                        {/* Mount error indicator */}
                        {entry.mount && isError && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0} className="flex items-center">
                                <AlertCircle className="h-4 w-4 text-red-400" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <span className="text-red-400">Error:</span>{' '}
                              {entry.mount.error || 'Failed to connect to this filesystem'}
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
                                  className={`rounded px-1.5 py-0.5 text-xs ${isError ? 'bg-red-400/10 text-red-400' : 'text-neutral3 bg-surface4'}`}
                                >
                                  {mountLabel}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{entry.mount.description}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs ${isError ? 'bg-red-400/10 text-red-400' : 'text-neutral3 bg-surface4'}`}
                            >
                              {mountLabel}
                            </span>
                          ))}
                        {entry.type === 'file' && entry.size !== undefined && (
                          <span className="text-neutral3 text-xs tabular-nums">{formatBytes(entry.size)}</span>
                        )}
                      </button>
                      {onDelete && !entry.mount && (
                        <button
                          onClick={() => handleDelete(entry)}
                          aria-label={`Delete ${entry.name}`}
                          className="text-neutral3 p-2 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
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
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
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
  const isDark = useTheme().resolvedTheme === 'dark';

  return (
    <SyntaxHighlighter
      language={language}
      style={isDark ? coldarkDark : coldarkCold}
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
    <div className="border-border1 overflow-hidden rounded-lg border">
      {/* Header */}
      <div className="bg-surface3 border-border1 flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          {getFileIcon({ name: fileName, type: 'file' })}
          <span className="text-neutral6 text-sm font-medium">{fileName}</span>
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
      <div className="bg-surface2 h-full max-h-[500px] overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-neutral3 h-6 w-6 animate-spin" />
          </div>
        ) : isImage ? (
          <div className="flex items-center justify-center p-4">
            <img
              src={`data:${mimeType || 'image/png'};base64,${btoa(content)}`}
              alt={fileName}
              className="max-h-[400px] max-w-full object-contain"
            />
          </div>
        ) : language ? (
          <HighlightedCode content={content} language={language} />
        ) : (
          <pre className="text-neutral5 overflow-x-auto p-4 font-mono text-sm whitespace-pre-wrap">{content}</pre>
        )}
      </div>
    </div>
  );
}
