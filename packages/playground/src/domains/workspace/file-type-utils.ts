/**
 * Shared file-type predicates for the workspace file browser/viewer. Kept out
 * of file-browser.tsx (which also exports React components) so Vite's Fast
 * Refresh boundary stays clean — mixing component and non-component exports
 * in one file breaks Fast Refresh for that file.
 *
 * Used both to decide the request encoding (pages/workspace/index.tsx) and to
 * decide the preview mode (FileViewer). Keeping these in sync matters:
 * requesting text encoding for a file FileViewer renders as media (or vice
 * versa) reproduces the btoa() InvalidCharacterError crash these predicates
 * exist to prevent — images crash outright, video just renders as garbled
 * binary text instead of a player.
 */

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'avif', 'tiff', 'tif'];
const VIDEO_MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  ogv: 'video/ogg',
};

export function isImageFile(path: string, mimeType?: string): boolean {
  if (mimeType?.startsWith('image/')) return true;
  const ext = path.split('/').pop()?.split('.').pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext ?? '');
}

export function isVideoFile(path: string, mimeType?: string): boolean {
  if (mimeType?.startsWith('video/')) return true;
  const ext = path.split('/').pop()?.split('.').pop()?.toLowerCase();
  return ext !== undefined && ext in VIDEO_MIME_TYPES;
}

export function videoMimeType(path: string, mimeType?: string): string {
  if (mimeType?.startsWith('video/')) return mimeType;
  const ext = path.split('/').pop()?.split('.').pop()?.toLowerCase();
  return VIDEO_MIME_TYPES[ext ?? ''] ?? 'video/mp4';
}
