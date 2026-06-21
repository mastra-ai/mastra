export type WorkspaceFilePreviewKind =
  | 'pdf'
  | 'image'
  | 'text'
  | 'csv'
  | 'spreadsheet'
  | 'document'
  | 'presentation'
  | 'unsupported';

const MiB = 1024 * 1024;

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif']);
const SPREADSHEET_EXTENSIONS = new Set(['xls', 'xlsx']);
const LEGACY_OFFICE_EXTENSIONS = new Set(['doc', 'ppt']);
const PLAIN_TEXT_EXTENSIONS = new Set(['csv', 'tsv', 'txt', 'log']);

const PREVIEW_SIZE_LIMITS: Record<WorkspaceFilePreviewKind, number | null> = {
  pdf: 25 * MiB,
  image: 25 * MiB,
  text: 2 * MiB,
  csv: 2 * MiB,
  spreadsheet: 10 * MiB,
  document: 10 * MiB,
  presentation: 10 * MiB,
  unsupported: null,
};

const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/javascript',
  'application/typescript',
  'application/xml',
  'application/yaml',
  'application/x-yaml',
  'application/toml',
  'application/graphql',
]);

const CSV_MIME_TYPES = new Set(['text/csv', 'text/tab-separated-values']);

const SPREADSHEET_MIME_TYPES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const DOCUMENT_MIME_TYPES = new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

const PRESENTATION_MIME_TYPES = new Set(['application/vnd.openxmlformats-officedocument.presentationml.presentation']);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  bash: 'bash',
  c: 'c',
  cpp: 'cpp',
  css: 'css',
  dockerfile: 'dockerfile',
  go: 'go',
  gql: 'graphql',
  graphql: 'graphql',
  h: 'c',
  hpp: 'cpp',
  htm: 'html',
  html: 'html',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsx: 'jsx',
  less: 'less',
  makefile: 'makefile',
  md: 'markdown',
  mdx: 'mdx',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  scss: 'scss',
  sh: 'bash',
  sql: 'sql',
  svelte: 'svelte',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'tsx',
  vue: 'vue',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'bash',
};

export function getWorkspaceFileName(path: string) {
  return path.split('/').filter(Boolean).pop() || path;
}

export function getWorkspaceFileParentPath(path: string) {
  const parent = path.split('/').slice(0, -1).join('/');
  return parent || '.';
}

function getExtension(path: string) {
  return getWorkspaceFileName(path).split('.').pop()?.toLowerCase();
}

export function formatWorkspaceFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '';
  if (bytes < 0) return '-' + formatWorkspaceFileSize(-bytes);
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getWorkspaceFileLanguageFromPath(path: string): string | null {
  const ext = getExtension(path);
  if (!ext) return null;
  return LANGUAGE_BY_EXTENSION[ext] || null;
}

export function getWorkspaceFilePreviewKind(path: string, mimeType?: string): WorkspaceFilePreviewKind {
  const ext = getExtension(path);

  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mimeType?.startsWith('image/') || (ext && IMAGE_EXTENSIONS.has(ext))) return 'image';
  if (ext === 'csv' || ext === 'tsv' || (mimeType && CSV_MIME_TYPES.has(mimeType))) return 'csv';
  if ((ext && SPREADSHEET_EXTENSIONS.has(ext)) || (mimeType && SPREADSHEET_MIME_TYPES.has(mimeType))) {
    return 'spreadsheet';
  }
  if (ext === 'docx' || (mimeType && DOCUMENT_MIME_TYPES.has(mimeType))) return 'document';
  if (ext === 'pptx' || (mimeType && PRESENTATION_MIME_TYPES.has(mimeType))) return 'presentation';
  if (ext && LEGACY_OFFICE_EXTENSIONS.has(ext)) return 'unsupported';
  if (ext && PLAIN_TEXT_EXTENSIONS.has(ext)) return 'text';
  if (mimeType?.startsWith('text/') || (mimeType && TEXT_MIME_TYPES.has(mimeType))) return 'text';
  if (getWorkspaceFileLanguageFromPath(path)) return 'text';

  return 'unsupported';
}

export function isWorkspaceFilePreviewBinary(kind: WorkspaceFilePreviewKind) {
  return kind === 'pdf' || kind === 'image' || kind === 'spreadsheet' || kind === 'document' || kind === 'presentation';
}

export function getWorkspaceFilePreviewSizeLimit(kind: WorkspaceFilePreviewKind) {
  return PREVIEW_SIZE_LIMITS[kind];
}

export function isWorkspaceFilePreviewTooLarge(kind: WorkspaceFilePreviewKind, size?: number) {
  const limit = getWorkspaceFilePreviewSizeLimit(kind);

  return typeof limit === 'number' && typeof size === 'number' && size > limit;
}
