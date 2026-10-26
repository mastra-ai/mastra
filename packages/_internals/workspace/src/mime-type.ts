import { posix } from 'node:path';

// A copy of the extension table behind `@mastra/core/workspace`'s `getMimeType`
// (the lookup `LocalFilesystem` uses). No published core release exports it yet
// (1.80.0-alpha.3 does not), so the providers that bundle this package cannot import it.
// mime-type.test.ts checks this copy against core's.
export const MIME_TYPES: Record<string, string> = {
  // Text
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  md: 'text/markdown',
  // Code
  js: 'application/javascript',
  mjs: 'application/javascript',
  ts: 'application/typescript',
  tsx: 'application/typescript',
  jsx: 'application/javascript',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  // Programming languages
  py: 'text/x-python',
  rb: 'text/x-ruby',
  go: 'text/x-go',
  rs: 'text/x-rust',
  java: 'text/x-java',
  c: 'text/x-c',
  cpp: 'text/x-c++',
  h: 'text/x-c',
  hpp: 'text/x-c++',
  sh: 'text/x-sh',
  bash: 'text/x-sh',
  zsh: 'text/x-sh',
  // Config
  toml: 'text/toml',
  ini: 'text/plain',
  env: 'text/plain',
  // Database/Query
  sql: 'text/x-sql',
  graphql: 'application/graphql',
  gql: 'application/graphql',
  // Frameworks
  vue: 'text/x-vue',
  svelte: 'text/x-svelte',
  // Web styles
  scss: 'text/x-scss',
  sass: 'text/x-sass',
  less: 'text/x-less',
  // Additional languages
  php: 'application/x-php',
  swift: 'text/x-swift',
  kt: 'text/x-kotlin',
  kts: 'text/x-kotlin',
  dart: 'application/dart',
  lua: 'text/x-lua',
  r: 'text/x-r',
  tf: 'text/x-terraform',
  tfvars: 'text/x-terraform',
  mdx: 'text/markdown',
  sas: 'text/plain',
  log: 'text/plain',
  jsonl: 'application/jsonl',
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  // Documents
  pdf: 'application/pdf',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  // Video
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  // Archives
  zip: 'application/zip',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  tgz: 'application/gzip',
  bz2: 'application/x-bzip2',
  '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar',
  // Executables / binaries
  exe: 'application/vnd.microsoft.portable-executable',
  dll: 'application/vnd.microsoft.portable-executable',
  so: 'application/x-sharedlib',
  dylib: 'application/x-sharedlib',
  bin: 'application/x-binary',
  dat: 'application/x-binary',
  // Disk images / packages
  dmg: 'application/x-apple-diskimage',
  iso: 'application/x-iso9660-image',
  deb: 'application/vnd.debian.binary-package',
  rpm: 'application/x-rpm',
  // Office documents
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Fonts
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  // Compiled code
  wasm: 'application/wasm',
  class: 'application/java-vm',
  pyc: 'application/x-python-code',
};

/** MIME type for a filename from its extension, or `application/octet-stream` when unknown. */
export function getMimeType(filename: string): string {
  const ext = posix.extname(filename).slice(1).toLowerCase();
  const mimeType = Object.hasOwn(MIME_TYPES, ext) ? MIME_TYPES[ext] : undefined;
  return typeof mimeType === 'string' ? mimeType : 'application/octet-stream';
}
